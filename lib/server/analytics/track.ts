import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { classifyTraffic } from "@/lib/analytics/channels"
import { getPrisma } from "@/lib/server/db"
import type { TrackPayload } from "@/lib/validations/analytics"

export function deviceFromUserAgent(userAgent: string | null | undefined) {
  if (!userAgent) return "desktop"
  const ua = userAgent.toLowerCase()
  if (/bot|crawl|spider|slurp|facebookexternalhit|whatsapp\/|preview|headless/.test(ua)) return "bot"
  if (/ipad|tablet|(android(?!.*mobile))/.test(ua)) return "tablet"
  if (/mobi|iphone|ipod|android|blackberry|opera mini|windows phone/.test(ua)) return "mobile"
  return "desktop"
}

function paramsFromPath(path: string) {
  try {
    const url = new URL(path, "http://localhost")
    const get = (key: string) => url.searchParams.get(key) ?? undefined
    return {
      utmSource: get("utm_source"),
      utmMedium: get("utm_medium"),
      utmCampaign: get("utm_campaign"),
      fbclid: get("fbclid"),
      gclid: get("gclid") ?? get("gbraid") ?? get("wbraid"),
    }
  } catch {
    return {}
  }
}

function stripQuery(path: string) {
  const index = path.indexOf("?")
  return index === -1 ? path : path.slice(0, index)
}

function externalReferrer(referrer: string | undefined, siteHost: string | null) {
  if (!referrer) return undefined
  try {
    const url = new URL(referrer)
    if (siteHost && url.host === siteHost) return undefined
    return referrer.slice(0, 1024)
  } catch {
    // android-app:// referrers are not valid URLs for the parser in some runtimes
    return referrer.startsWith("android-app://") ? referrer.slice(0, 1024) : undefined
  }
}

export type TrackContext = {
  userAgent: string | null
  userId: string | null
  siteHost: string | null
  country: string | null
}

/**
 * Persists a batch of storefront events. Sessions are created lazily from
 * the first event seen for a session id, so blocked or lost beacons never
 * break anything. Traffic attribution is decided once, at session start.
 */
export async function recordAnalyticsBatch(payload: TrackPayload, context: TrackContext) {
  const prisma = getPrisma()
  const device = deviceFromUserAgent(context.userAgent)
  if (device === "bot") return

  const firstPageView = payload.events.find((event) => event.type === "PAGE_VIEW") ?? payload.events[0]
  const pageViews = payload.events.filter((event) => event.type === "PAGE_VIEW").length
  const now = new Date()

  const params = paramsFromPath(firstPageView.path)
  const referrer = externalReferrer(firstPageView.referrer, context.siteHost)
  const attribution = classifyTraffic({
    referrer,
    utmSource: params.utmSource,
    utmMedium: params.utmMedium,
    fbclid: params.fbclid,
    gclid: params.gclid,
  })

  await prisma.analyticsSession.upsert({
    where: { id: payload.sessionId },
    create: {
      id: payload.sessionId,
      visitorId: payload.visitorId,
      userId: context.userId,
      landingPath: stripQuery(firstPageView.path).slice(0, 512),
      referrer,
      utmSource: params.utmSource?.slice(0, 200),
      utmMedium: params.utmMedium?.slice(0, 200),
      utmCampaign: params.utmCampaign?.slice(0, 200),
      fbclid: params.fbclid?.slice(0, 200),
      gclid: params.gclid?.slice(0, 200),
      channel: attribution.channel,
      source: attribution.source?.slice(0, 200) ?? null,
      medium: attribution.medium?.slice(0, 100) ?? null,
      userAgent: context.userAgent?.slice(0, 512),
      device,
      country: context.country ?? undefined,
      pageViews,
      startedAt: now,
      lastSeenAt: now,
    },
    update: {
      lastSeenAt: now,
      pageViews: { increment: pageViews },
      ...(context.userId ? { userId: context.userId } : {}),
    },
  })

  await prisma.analyticsEvent.createMany({
    data: payload.events.map((event) => ({
      sessionId: payload.sessionId,
      type: event.type,
      path: stripQuery(event.path).slice(0, 512),
      name: event.name?.slice(0, 200),
      payload: (event.payload ?? undefined) as Prisma.InputJsonValue | undefined,
      createdAt: event.ts ? new Date(event.ts) : now,
    })),
  })
}
