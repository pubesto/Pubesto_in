import { after } from "next/server"

import { recordAnalyticsBatch } from "@/lib/server/analytics/track"
import { getCurrentUser } from "@/lib/server/dal/auth"
import { getSiteUrl } from "@/lib/server/env"
import { trackPayloadSchema } from "@/lib/validations/analytics"

export const dynamic = "force-dynamic"

const noContent = () => new Response(null, { status: 204 })

/**
 * Receives storefront behaviour beacons. Responds immediately and writes the
 * batch after the response so tracking never slows the page down.
 */
export async function POST(request: Request) {
  let payload: unknown
  try {
    // sendBeacon posts text/plain; fetch posts application/json. Both are JSON.
    payload = JSON.parse(await request.text())
  } catch {
    return noContent()
  }

  const result = trackPayloadSchema.safeParse(payload)
  if (!result.success) {
    return noContent()
  }

  const userAgent = request.headers.get("user-agent")
  const country =
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-vercel-ip-country") ??
    null

  let userId: string | null = null
  try {
    userId = (await getCurrentUser())?.id ?? null
  } catch {
    userId = null
  }

  let siteHost: string | null = null
  try {
    siteHost = new URL(getSiteUrl()).host
  } catch {
    siteHost = null
  }

  after(async () => {
    try {
      await recordAnalyticsBatch(result.data, { userAgent, userId, siteHost, country })
    } catch (error) {
      console.error("[analytics] failed to record batch", error)
    }
  })

  return noContent()
}
