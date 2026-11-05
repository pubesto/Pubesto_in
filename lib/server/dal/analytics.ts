import "server-only"

import {
  addDays,
  addHours,
  differenceInDays,
  endOfDay,
  format,
  startOfDay,
  startOfHour,
  startOfQuarter,
  subDays,
} from "date-fns"

import { CHANNEL_DISPLAY_ORDER, channelLabel } from "@/lib/analytics/channels"
import { findReport, type ReportResult } from "@/lib/analytics/reports"
import { requirePermission } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"
import type { AnalyticsRangeInput } from "@/lib/validations/analytics"

/* ───────────────────────── Range handling ───────────────────────── */

export type AnalyticsRange = {
  from: Date
  to: Date
  prevFrom: Date
  prevTo: Date
  days: number
  hourly: boolean
  label: string
  currentLabel: string
  previousLabel: string
}

export const ANALYTICS_PRESETS = [
  "Today",
  "Yesterday",
  "Last 7 days",
  "Last 30 days",
  "Last 90 days",
  "Quarter to date",
] as const

export function resolveAnalyticsRange(input?: AnalyticsRangeInput): AnalyticsRange {
  const now = new Date()
  const preset = input?.preset ?? (input?.from || input?.days ? "Custom" : "Last 30 days")

  let from: Date
  let to: Date
  let label = preset

  if (preset === "Today") {
    from = startOfDay(now)
    to = endOfDay(now)
  } else if (preset === "Yesterday") {
    from = startOfDay(subDays(now, 1))
    to = endOfDay(subDays(now, 1))
  } else if (preset === "Last 7 days") {
    from = startOfDay(subDays(now, 6))
    to = endOfDay(now)
  } else if (preset === "Last 90 days") {
    from = startOfDay(subDays(now, 89))
    to = endOfDay(now)
  } else if (preset === "Quarter to date") {
    from = startOfQuarter(now)
    to = endOfDay(now)
  } else if (input?.from) {
    from = startOfDay(new Date(input.from))
    to = endOfDay(input.to ? new Date(input.to) : new Date(input.from))
    label = `${format(from, "d MMM yyyy")} – ${format(to, "d MMM yyyy")}`
  } else if (input?.days) {
    from = startOfDay(subDays(now, input.days - 1))
    to = endOfDay(now)
    label = `Last ${input.days} days`
  } else {
    from = startOfDay(subDays(now, 29))
    to = endOfDay(now)
    label = "Last 30 days"
  }

  const days = Math.max(1, differenceInDays(to, from) + 1)
  const prevTo = endOfDay(subDays(from, 1))
  const prevFrom = startOfDay(subDays(prevTo, days - 1))

  return {
    from,
    to,
    prevFrom,
    prevTo,
    days,
    hourly: days <= 1,
    label,
    currentLabel: days <= 1 ? format(from, "MMM d, yyyy") : `${format(from, "MMM d")} – ${format(to, "MMM d, yyyy")}`,
    previousLabel: days <= 1 ? format(prevFrom, "MMM d, yyyy") : `${format(prevFrom, "MMM d")} – ${format(prevTo, "MMM d, yyyy")}`,
  }
}

/* ───────────────────────── Types ───────────────────────── */

export type AnalyticsMetric = {
  key: string
  label: string
  value: string
  rawValue: number
  change: string
  isPositive: boolean | null
}

export type AnalyticsPoint = {
  key: string
  label: string
  sessions: number
  visitors: number
  orders: number
  sales: number
  conversion: number
  bounceRate: number
  searches: number
  previousSessions: number
  previousOrders: number
  previousSales: number
  previousConversion: number
}

export type ChannelRow = {
  channel: string
  label: string
  sessions: number
  share: number
  orders: number
  sales: number
  conversionRate: number
}

export type StoreAnalytics = {
  range: { label: string; currentLabel: string; previousLabel: string; from: string; to: string; hourly: boolean }
  metrics: AnalyticsMetric[]
  timeseries: AnalyticsPoint[]
  devices: Array<{ device: string; sessions: number; share: number }>
  channels: ChannelRow[]
  campaigns: Array<{ campaign: string; source: string; sessions: number; orders: number; sales: number }>
  landingPages: Array<{ path: string; sessions: number; share: number }>
  referrers: Array<{ referrer: string; channel: string; sessions: number }>
  topPages: Array<{ path: string; views: number }>
  countries: Array<{ country: string; sessions: number }>
  funnel: {
    sessions: number
    productViews: number
    addToCart: number
    beginCheckout: number
    purchases: number
  }
  topSearches: Array<{ query: string; searches: number; averageResults: number }>
  zeroResultSearches: Array<{ query: string; searches: number }>
  topProducts: Array<{ name: string; views: number; addToCart: number }>
  salesByProduct: Array<{ title: string; units: number; sales: number }>
  newVsReturning: { newVisitors: number; returningVisitors: number }
  recordings: { count: number; converted: number }
  sales: {
    gross: number
    discounts: number
    shipping: number
    taxes: number
    total: number
    orders: number
    averageOrderValue: number
  }
}

/* ───────────────────────── Helpers ───────────────────────── */

function money(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount)
}

function change(current: number, previous: number): { change: string; isPositive: boolean | null } {
  if (previous === 0) {
    return current > 0 ? { change: "↗ 100%", isPositive: true } : { change: "—", isPositive: null }
  }
  const diff = ((current - previous) / previous) * 100
  const rounded = Math.abs(Math.round(diff))
  if (diff > 0) return { change: `↗ ${rounded}%`, isPositive: true }
  if (diff < 0) return { change: `↘ ${rounded}%`, isPositive: false }
  return { change: "0%", isPositive: null }
}

function bucketKey(date: Date, hourly: boolean) {
  return hourly ? format(startOfHour(date), "yyyy-MM-dd HH") : format(date, "yyyy-MM-dd")
}

function bucketLabel(key: string, hourly: boolean) {
  if (hourly) {
    const hour = Number(key.slice(11))
    const suffix = hour >= 12 ? "PM" : "AM"
    const display = hour % 12 === 0 ? 12 : hour % 12
    return `${display} ${suffix}`
  }
  return format(new Date(`${key}T00:00:00`), "MMM d")
}

function buckets(range: { from: Date; to: Date; hourly: boolean }) {
  const keys: string[] = []
  if (range.hourly) {
    for (let cursor = startOfHour(range.from); cursor <= range.to; cursor = addHours(cursor, 1)) {
      keys.push(bucketKey(cursor, true))
    }
  } else {
    for (let cursor = startOfDay(range.from); cursor <= range.to; cursor = addDays(cursor, 1)) {
      keys.push(bucketKey(cursor, false))
    }
  }
  return keys
}

type SessionLite = {
  id: string
  visitorId: string
  startedAt: Date
  pageViews: number
  device: string
  channel: string
  source: string | null
  referrer: string | null
  landingPath: string
  country: string | null
  utmCampaign: string | null
  converted: boolean
}

type OrderLite = {
  id: string
  createdAt: Date
  total: number
  subtotal: number
  discount: number
  shipping: number
  tax: number
  analyticsSessionId: string | null
}

/* ───────────────────────── Main dataset ───────────────────────── */

export async function getStoreAnalytics(input?: AnalyticsRangeInput): Promise<StoreAnalytics> {
  await requirePermission("analytics.view")
  const prisma = getPrisma()
  const range = resolveAnalyticsRange(input)

  const sessionSelect = {
    id: true,
    visitorId: true,
    startedAt: true,
    pageViews: true,
    device: true,
    channel: true,
    source: true,
    referrer: true,
    landingPath: true,
    country: true,
    utmCampaign: true,
    converted: true,
  } as const

  const orderWhere = (from: Date, to: Date) => ({
    createdAt: { gte: from, lte: to },
    status: { not: "CANCELLED" as const },
    source: "STOREFRONT",
  })

  const [
    sessions,
    prevSessions,
    ordersRaw,
    prevOrdersRaw,
    productViewGroups,
    addToCartGroups,
    beginCheckoutGroups,
    purchaseGroups,
    pageGroups,
    searchGroups,
    zeroResultGroups,
    searchRows,
    productViewByName,
    addToCartByName,
    soldItems,
    recordingCount,
    recordingConverted,
    returningVisitorRows,
  ] = await Promise.all([
    prisma.analyticsSession.findMany({ where: { startedAt: { gte: range.from, lte: range.to } }, select: sessionSelect }),
    prisma.analyticsSession.findMany({ where: { startedAt: { gte: range.prevFrom, lte: range.prevTo } }, select: sessionSelect }),
    prisma.order.findMany({
      where: orderWhere(range.from, range.to),
      select: { id: true, createdAt: true, total: true, subtotal: true, discount: true, shipping: true, tax: true, analyticsSessionId: true },
    }),
    prisma.order.findMany({
      where: orderWhere(range.prevFrom, range.prevTo),
      select: { id: true, createdAt: true, total: true, subtotal: true, discount: true, shipping: true, tax: true, analyticsSessionId: true },
    }),
    prisma.analyticsEvent.groupBy({ by: ["sessionId"], where: { type: "PRODUCT_VIEW", createdAt: { gte: range.from, lte: range.to } } }),
    prisma.analyticsEvent.groupBy({ by: ["sessionId"], where: { type: "ADD_TO_CART", createdAt: { gte: range.from, lte: range.to } } }),
    prisma.analyticsEvent.groupBy({ by: ["sessionId"], where: { type: "BEGIN_CHECKOUT", createdAt: { gte: range.from, lte: range.to } } }),
    prisma.analyticsEvent.groupBy({ by: ["sessionId"], where: { type: "PURCHASE", createdAt: { gte: range.from, lte: range.to } } }),
    prisma.analyticsEvent.groupBy({
      by: ["path"],
      where: { type: "PAGE_VIEW", createdAt: { gte: range.from, lte: range.to } },
      _count: { _all: true },
      orderBy: { _count: { path: "desc" } },
      take: 15,
    }),
    prisma.searchLog.groupBy({
      by: ["normalized"],
      where: { createdAt: { gte: range.from, lte: range.to } },
      _count: { _all: true },
      _avg: { resultCount: true },
      orderBy: { _count: { normalized: "desc" } },
      take: 25,
    }),
    prisma.searchLog.groupBy({
      by: ["normalized"],
      where: { createdAt: { gte: range.from, lte: range.to }, resultCount: 0 },
      _count: { _all: true },
      orderBy: { _count: { normalized: "desc" } },
      take: 25,
    }),
    prisma.searchLog.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      select: { createdAt: true },
      take: 20000,
    }),
    prisma.analyticsEvent.groupBy({
      by: ["name"],
      where: { type: "PRODUCT_VIEW", createdAt: { gte: range.from, lte: range.to }, name: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { name: "desc" } },
      take: 15,
    }),
    prisma.analyticsEvent.groupBy({
      by: ["name"],
      where: { type: "ADD_TO_CART", createdAt: { gte: range.from, lte: range.to }, name: { not: null } },
      _count: { _all: true },
    }),
    prisma.orderItem.groupBy({
      by: ["title"],
      where: { order: orderWhere(range.from, range.to) },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: "desc" } },
      take: 15,
    }),
    prisma.sessionRecording.count({ where: { startedAt: { gte: range.from, lte: range.to }, eventCount: { gt: 2 } } }),
    prisma.sessionRecording.count({ where: { startedAt: { gte: range.from, lte: range.to }, converted: true } }),
    prisma.analyticsSession.findMany({
      where: { startedAt: { lt: range.from } },
      select: { visitorId: true },
      distinct: ["visitorId"],
      take: 50000,
    }),
  ])

  const orders: OrderLite[] = ordersRaw.map((order) => ({
    id: order.id,
    createdAt: order.createdAt,
    total: Number(order.total),
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    shipping: Number(order.shipping),
    tax: Number(order.tax),
    analyticsSessionId: order.analyticsSessionId,
  }))
  const prevOrders: OrderLite[] = prevOrdersRaw.map((order) => ({
    id: order.id,
    createdAt: order.createdAt,
    total: Number(order.total),
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    shipping: Number(order.shipping),
    tax: Number(order.tax),
    analyticsSessionId: order.analyticsSessionId,
  }))

  /* Timeseries */
  const keys = buckets(range)
  const prevKeys = buckets({ from: range.prevFrom, to: range.prevTo, hourly: range.hourly })
  const series = new Map<string, AnalyticsPoint>()
  keys.forEach((key, index) => {
    series.set(key, {
      key,
      label: bucketLabel(key, range.hourly),
      sessions: 0,
      visitors: 0,
      orders: 0,
      sales: 0,
      conversion: 0,
      bounceRate: 0,
      searches: 0,
      previousSessions: 0,
      previousOrders: 0,
      previousSales: 0,
      previousConversion: 0,
    })
    void index
  })
  const prevIndexByKey = new Map(prevKeys.map((key, index) => [key, index]))

  const visitorsByBucket = new Map<string, Set<string>>()
  const bouncesByBucket = new Map<string, number>()
  for (const session of sessions as SessionLite[]) {
    const key = bucketKey(session.startedAt, range.hourly)
    const point = series.get(key)
    if (!point) continue
    point.sessions += 1
    if (!visitorsByBucket.has(key)) visitorsByBucket.set(key, new Set())
    visitorsByBucket.get(key)!.add(session.visitorId)
    if (session.pageViews <= 1) bouncesByBucket.set(key, (bouncesByBucket.get(key) ?? 0) + 1)
  }
  for (const order of orders) {
    const point = series.get(bucketKey(order.createdAt, range.hourly))
    if (!point) continue
    point.orders += 1
    point.sales += order.total
  }
  for (const row of searchRows) {
    const point = series.get(bucketKey(row.createdAt, range.hourly))
    if (point) point.searches += 1
  }
  for (const session of prevSessions as SessionLite[]) {
    const index = prevIndexByKey.get(bucketKey(session.startedAt, range.hourly))
    if (index === undefined) continue
    const point = series.get(keys[index])
    if (point) point.previousSessions += 1
  }
  for (const order of prevOrders) {
    const index = prevIndexByKey.get(bucketKey(order.createdAt, range.hourly))
    if (index === undefined) continue
    const point = series.get(keys[index])
    if (point) {
      point.previousOrders += 1
      point.previousSales += order.total
    }
  }
  for (const point of series.values()) {
    point.visitors = visitorsByBucket.get(point.key)?.size ?? 0
    point.conversion = point.sessions ? Number(((point.orders / point.sessions) * 100).toFixed(2)) : 0
    point.bounceRate = point.sessions ? Math.round(((bouncesByBucket.get(point.key) ?? 0) / point.sessions) * 100) : 0
    point.previousConversion = point.previousSessions ? Number(((point.previousOrders / point.previousSessions) * 100).toFixed(2)) : 0
  }

  /* Totals + metrics */
  const sessionCount = sessions.length
  const prevSessionCount = prevSessions.length
  const visitorCount = new Set(sessions.map((session) => session.visitorId)).size
  const prevVisitorCount = new Set(prevSessions.map((session) => session.visitorId)).size
  const salesTotal = orders.reduce((sum, order) => sum + order.total, 0)
  const prevSalesTotal = prevOrders.reduce((sum, order) => sum + order.total, 0)
  const conversion = sessionCount ? (orders.length / sessionCount) * 100 : 0
  const prevConversion = prevSessionCount ? (prevOrders.length / prevSessionCount) * 100 : 0
  const bounces = sessions.filter((session) => session.pageViews <= 1).length
  const prevBounces = prevSessions.filter((session) => session.pageViews <= 1).length
  const bounceRate = sessionCount ? (bounces / sessionCount) * 100 : 0
  const prevBounceRate = prevSessionCount ? (prevBounces / prevSessionCount) * 100 : 0
  const aov = orders.length ? salesTotal / orders.length : 0
  const prevAov = prevOrders.length ? prevSalesTotal / prevOrders.length : 0
  const pagesPerSession = sessionCount ? sessions.reduce((sum, session) => sum + session.pageViews, 0) / sessionCount : 0
  const prevPagesPerSession = prevSessionCount ? prevSessions.reduce((sum, session) => sum + session.pageViews, 0) / prevSessionCount : 0

  const metric = (key: string, label: string, current: number, previous: number, formatValue: (value: number) => string, invert = false): AnalyticsMetric => {
    const delta = change(current, previous)
    return {
      key,
      label,
      value: formatValue(current),
      rawValue: current,
      change: delta.change,
      isPositive: delta.isPositive === null ? null : invert ? !delta.isPositive : delta.isPositive,
    }
  }

  const metrics: AnalyticsMetric[] = [
    metric("sessions", "Sessions", sessionCount, prevSessionCount, (value) => value.toLocaleString("en-IN")),
    metric("visitors", "Visitors", visitorCount, prevVisitorCount, (value) => value.toLocaleString("en-IN")),
    metric("sales", "Total sales", salesTotal, prevSalesTotal, money),
    metric("orders", "Orders", orders.length, prevOrders.length, (value) => value.toLocaleString("en-IN")),
    metric("conversion", "Conversion rate", conversion, prevConversion, (value) => `${value.toFixed(2)}%`),
    metric("aov", "Average order value", aov, prevAov, money),
    metric("bounce", "Bounce rate", bounceRate, prevBounceRate, (value) => `${Math.round(value)}%`, true),
    metric("pages", "Pages per session", pagesPerSession, prevPagesPerSession, (value) => value.toFixed(1)),
  ]

  /* Devices */
  const deviceCounts = new Map<string, number>()
  for (const session of sessions) deviceCounts.set(session.device, (deviceCounts.get(session.device) ?? 0) + 1)
  const devices = ["desktop", "mobile", "tablet"]
    .map((device) => ({ device, sessions: deviceCounts.get(device) ?? 0, share: sessionCount ? Math.round(((deviceCounts.get(device) ?? 0) / sessionCount) * 100) : 0 }))
    .filter((row) => row.sessions > 0 || sessionCount === 0)

  /* Channels with attributed orders */
  const sessionById = new Map((sessions as SessionLite[]).map((session) => [session.id, session]))
  const ordersByChannel = new Map<string, { orders: number; sales: number }>()
  const ordersByCampaign = new Map<string, { orders: number; sales: number }>()
  for (const order of orders) {
    const session = order.analyticsSessionId ? sessionById.get(order.analyticsSessionId) : undefined
    const channel = session?.channel ?? "direct"
    const bucket = ordersByChannel.get(channel) ?? { orders: 0, sales: 0 }
    bucket.orders += 1
    bucket.sales += order.total
    ordersByChannel.set(channel, bucket)
    if (session?.utmCampaign) {
      const campaignBucket = ordersByCampaign.get(session.utmCampaign) ?? { orders: 0, sales: 0 }
      campaignBucket.orders += 1
      campaignBucket.sales += order.total
      ordersByCampaign.set(session.utmCampaign, campaignBucket)
    }
  }
  const channelCounts = new Map<string, number>()
  for (const session of sessions) channelCounts.set(session.channel, (channelCounts.get(session.channel) ?? 0) + 1)
  const channels: ChannelRow[] = [...new Set([...CHANNEL_DISPLAY_ORDER, ...channelCounts.keys()])]
    .map((channel) => {
      const count = channelCounts.get(channel) ?? 0
      const attributed = ordersByChannel.get(channel) ?? { orders: 0, sales: 0 }
      return {
        channel,
        label: channelLabel(channel),
        sessions: count,
        share: sessionCount ? Math.round((count / sessionCount) * 100) : 0,
        orders: attributed.orders,
        sales: attributed.sales,
        conversionRate: count ? Number(((attributed.orders / count) * 100).toFixed(2)) : 0,
      }
    })
    .filter((row) => row.sessions > 0 || row.orders > 0)
    .sort((a, b) => b.sessions - a.sessions)

  /* Campaigns */
  const campaignCounts = new Map<string, { source: string; sessions: number }>()
  for (const session of sessions as SessionLite[]) {
    if (!session.utmCampaign) continue
    const bucket = campaignCounts.get(session.utmCampaign) ?? { source: session.source ?? session.channel, sessions: 0 }
    bucket.sessions += 1
    campaignCounts.set(session.utmCampaign, bucket)
  }
  const campaigns = [...campaignCounts.entries()]
    .map(([campaign, bucket]) => ({
      campaign,
      source: bucket.source,
      sessions: bucket.sessions,
      orders: ordersByCampaign.get(campaign)?.orders ?? 0,
      sales: ordersByCampaign.get(campaign)?.sales ?? 0,
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 20)

  /* Landing pages, referrers, countries */
  const landingCounts = new Map<string, number>()
  const referrerCounts = new Map<string, { channel: string; sessions: number }>()
  const countryCounts = new Map<string, number>()
  for (const session of sessions as SessionLite[]) {
    landingCounts.set(session.landingPath, (landingCounts.get(session.landingPath) ?? 0) + 1)
    const referrerKey = session.referrer ? hostLabel(session.referrer) : session.source ?? "Direct"
    const referrerBucket = referrerCounts.get(referrerKey) ?? { channel: session.channel, sessions: 0 }
    referrerBucket.sessions += 1
    referrerCounts.set(referrerKey, referrerBucket)
    const country = session.country ?? "Unknown"
    countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1)
  }
  const landingPages = [...landingCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([path, count]) => ({ path, sessions: count, share: sessionCount ? Math.round((count / sessionCount) * 100) : 0 }))
  const referrers = [...referrerCounts.entries()]
    .sort((a, b) => b[1].sessions - a[1].sessions)
    .slice(0, 15)
    .map(([referrer, bucket]) => ({ referrer, channel: bucket.channel, sessions: bucket.sessions }))
  const countries = [...countryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([country, count]) => ({ country, sessions: count }))

  /* Products */
  const addToCartMap = new Map(addToCartByName.map((group) => [group.name ?? "", group._count._all]))
  const topProducts = productViewByName.map((group) => ({
    name: group.name ?? "",
    views: group._count._all,
    addToCart: addToCartMap.get(group.name ?? "") ?? 0,
  }))

  /* New vs returning */
  const knownVisitors = new Set(returningVisitorRows.map((row) => row.visitorId))
  const visitorsInRange = new Set(sessions.map((session) => session.visitorId))
  let returningVisitors = 0
  for (const visitor of visitorsInRange) if (knownVisitors.has(visitor)) returningVisitors += 1

  return {
    range: {
      label: range.label,
      currentLabel: range.currentLabel,
      previousLabel: range.previousLabel,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      hourly: range.hourly,
    },
    metrics,
    timeseries: [...series.values()],
    devices,
    channels,
    campaigns,
    landingPages,
    referrers,
    topPages: pageGroups.map((group) => ({ path: group.path, views: group._count._all })),
    countries,
    funnel: {
      sessions: sessionCount,
      productViews: productViewGroups.length,
      addToCart: addToCartGroups.length,
      beginCheckout: beginCheckoutGroups.length,
      purchases: Math.max(purchaseGroups.length, orders.filter((order) => order.analyticsSessionId).length),
    },
    topSearches: searchGroups.map((group) => ({
      query: group.normalized,
      searches: group._count._all,
      averageResults: Number((group._avg.resultCount ?? 0).toFixed(1)),
    })),
    zeroResultSearches: zeroResultGroups.map((group) => ({ query: group.normalized, searches: group._count._all })),
    topProducts,
    salesByProduct: soldItems.map((item) => ({
      title: item.title,
      units: item._sum.quantity ?? 0,
      sales: Number(item._sum.total ?? 0),
    })),
    newVsReturning: {
      newVisitors: Math.max(0, visitorsInRange.size - returningVisitors),
      returningVisitors,
    },
    recordings: { count: recordingCount, converted: recordingConverted },
    sales: {
      gross: orders.reduce((sum, order) => sum + order.subtotal, 0),
      discounts: orders.reduce((sum, order) => sum + order.discount, 0),
      shipping: orders.reduce((sum, order) => sum + order.shipping, 0),
      taxes: orders.reduce((sum, order) => sum + order.tax, 0),
      total: salesTotal,
      orders: orders.length,
      averageOrderValue: aov,
    },
  }
}

function hostLabel(referrer: string) {
  try {
    const url = new URL(referrer)
    if (url.protocol === "android-app:") return referrer.replace("android-app://", "app: ")
    return url.host.replace(/^www\./, "")
  } catch {
    return referrer.slice(0, 80)
  }
}

/* ───────────────────────── Reports ───────────────────────── */

export async function getReport(slug: string, input?: AnalyticsRangeInput): Promise<ReportResult | null> {
  const definition = findReport(slug)
  if (!definition) return null
  const data = await getStoreAnalytics(input)
  const base = {
    slug: definition.slug,
    name: definition.name,
    category: definition.category,
    description: definition.description,
    rangeLabel: data.range.label,
  }
  const timeRows = data.timeseries.map((point) => ({ ...point, date: point.label }))

  switch (slug) {
    case "sessions-over-time":
      return {
        ...base,
        summary: [{ label: "Sessions", value: data.metrics[0].value }, { label: "vs previous", value: data.metrics[0].change }],
        columns: [{ key: "date", label: "Date" }, { key: "sessions", label: "Sessions", format: "number", align: "right" }, { key: "previousSessions", label: "Previous period", format: "number", align: "right" }],
        rows: timeRows,
        chart: { type: "line", xKey: "date", series: [{ key: "sessions", label: data.range.currentLabel }, { key: "previousSessions", label: data.range.previousLabel, color: "#8bd4f5" }] },
      }
    case "visitors-over-time":
      return {
        ...base,
        summary: [{ label: "Visitors", value: data.metrics[1].value }, { label: "vs previous", value: data.metrics[1].change }],
        columns: [{ key: "date", label: "Date" }, { key: "visitors", label: "Visitors", format: "number", align: "right" }, { key: "sessions", label: "Sessions", format: "number", align: "right" }],
        rows: timeRows,
        chart: { type: "line", xKey: "date", series: [{ key: "visitors", label: "Visitors" }] },
      }
    case "sessions-by-channel":
      return {
        ...base,
        summary: [{ label: "Channels", value: String(data.channels.length) }, { label: "Sessions", value: data.metrics[0].value }],
        columns: [{ key: "label", label: "Traffic source" }, { key: "sessions", label: "Sessions", format: "number", align: "right" }, { key: "share", label: "Share", format: "percent", align: "right" }, { key: "orders", label: "Orders", format: "number", align: "right" }, { key: "conversionRate", label: "Conversion", format: "percent", align: "right" }, { key: "sales", label: "Sales", format: "currency", align: "right" }],
        rows: data.channels,
        chart: { type: "bar", xKey: "label", series: [{ key: "sessions", label: "Sessions" }] },
      }
    case "sessions-by-referrer":
      return {
        ...base,
        summary: [{ label: "Referrers", value: String(data.referrers.length) }],
        columns: [{ key: "referrer", label: "Referrer" }, { key: "channelLabel", label: "Channel" }, { key: "sessions", label: "Sessions", format: "number", align: "right" }],
        rows: data.referrers.map((row) => ({ ...row, channelLabel: channelLabel(row.channel) })),
        chart: { type: "bar", xKey: "referrer", series: [{ key: "sessions", label: "Sessions" }] },
      }
    case "sessions-by-campaign":
      return {
        ...base,
        summary: [{ label: "Campaigns", value: String(data.campaigns.length) }],
        columns: [{ key: "campaign", label: "Campaign (utm_campaign)" }, { key: "source", label: "Source" }, { key: "sessions", label: "Sessions", format: "number", align: "right" }, { key: "orders", label: "Orders", format: "number", align: "right" }, { key: "sales", label: "Sales", format: "currency", align: "right" }],
        rows: data.campaigns,
        chart: { type: "bar", xKey: "campaign", series: [{ key: "sessions", label: "Sessions" }] },
      }
    case "sessions-by-location":
      return {
        ...base,
        summary: [{ label: "Countries", value: String(data.countries.length) }],
        columns: [{ key: "country", label: "Country" }, { key: "sessions", label: "Sessions", format: "number", align: "right" }],
        rows: data.countries,
        chart: { type: "bar", xKey: "country", series: [{ key: "sessions", label: "Sessions" }] },
      }
    case "new-vs-returning":
      return {
        ...base,
        summary: [{ label: "New", value: String(data.newVsReturning.newVisitors) }, { label: "Returning", value: String(data.newVsReturning.returningVisitors) }],
        columns: [{ key: "type", label: "Visitor type" }, { key: "visitors", label: "Visitors", format: "number", align: "right" }],
        rows: [{ type: "New visitors", visitors: data.newVsReturning.newVisitors }, { type: "Returning visitors", visitors: data.newVsReturning.returningVisitors }],
        chart: { type: "bar", xKey: "type", series: [{ key: "visitors", label: "Visitors" }] },
      }
    case "sessions-by-device":
      return {
        ...base,
        summary: data.devices.map((row) => ({ label: row.device, value: `${row.share}%` })),
        columns: [{ key: "device", label: "Device" }, { key: "sessions", label: "Sessions", format: "number", align: "right" }, { key: "share", label: "Share", format: "percent", align: "right" }],
        rows: data.devices,
        chart: { type: "bar", xKey: "device", series: [{ key: "sessions", label: "Sessions" }] },
      }
    case "sessions-by-landing-page":
      return {
        ...base,
        summary: [{ label: "Landing pages", value: String(data.landingPages.length) }],
        columns: [{ key: "path", label: "Landing page" }, { key: "sessions", label: "Sessions", format: "number", align: "right" }, { key: "share", label: "Share", format: "percent", align: "right" }],
        rows: data.landingPages,
        chart: { type: "bar", xKey: "path", series: [{ key: "sessions", label: "Sessions" }] },
      }
    case "pages-by-views":
      return {
        ...base,
        summary: [{ label: "Pages", value: String(data.topPages.length) }],
        columns: [{ key: "path", label: "Page" }, { key: "views", label: "Views", format: "number", align: "right" }],
        rows: data.topPages,
        chart: { type: "bar", xKey: "path", series: [{ key: "views", label: "Views" }] },
      }
    case "bounce-rate-over-time":
      return {
        ...base,
        summary: [{ label: "Bounce rate", value: data.metrics[6].value }],
        columns: [{ key: "date", label: "Date" }, { key: "sessions", label: "Sessions", format: "number", align: "right" }, { key: "bounceRate", label: "Bounce rate", format: "percent", align: "right" }],
        rows: timeRows,
        chart: { type: "line", xKey: "date", series: [{ key: "bounceRate", label: "Bounce rate", format: "percent" }] },
      }
    case "conversion-rate-over-time":
      return {
        ...base,
        summary: [{ label: "Conversion rate", value: data.metrics[4].value }, { label: "vs previous", value: data.metrics[4].change }],
        columns: [{ key: "date", label: "Date" }, { key: "sessions", label: "Sessions", format: "number", align: "right" }, { key: "orders", label: "Orders", format: "number", align: "right" }, { key: "conversion", label: "Conversion", format: "percent", align: "right" }],
        rows: timeRows,
        chart: { type: "line", xKey: "date", series: [{ key: "conversion", label: data.range.currentLabel, format: "percent" }, { key: "previousConversion", label: data.range.previousLabel, color: "#8bd4f5", format: "percent" }] },
      }
    case "checkout-funnel": {
      const steps = [
        ["Sessions", data.funnel.sessions],
        ["Viewed a product", data.funnel.productViews],
        ["Added to bag", data.funnel.addToCart],
        ["Reached checkout", data.funnel.beginCheckout],
        ["Completed order", data.funnel.purchases],
      ] as const
      return {
        ...base,
        summary: [{ label: "Overall", value: `${data.funnel.sessions ? ((data.funnel.purchases / data.funnel.sessions) * 100).toFixed(2) : "0.00"}%` }],
        columns: [{ key: "step", label: "Step" }, { key: "sessions", label: "Sessions", format: "number", align: "right" }, { key: "ofTotal", label: "Of all sessions", format: "percent", align: "right" }, { key: "dropOff", label: "Drop-off from previous", format: "percent", align: "right" }],
        rows: steps.map(([step, count], index) => {
          const previous = index === 0 ? count : steps[index - 1][1]
          return {
            step,
            sessions: count,
            ofTotal: data.funnel.sessions ? Math.round((count / data.funnel.sessions) * 100) : 0,
            dropOff: index === 0 ? 0 : previous ? Math.round(((previous - count) / previous) * 100) : 0,
          }
        }),
        chart: { type: "bar", xKey: "step", series: [{ key: "sessions", label: "Sessions" }] },
      }
    }
    case "products-by-views":
      return {
        ...base,
        summary: [{ label: "Products viewed", value: String(data.topProducts.length) }],
        columns: [{ key: "name", label: "Product" }, { key: "views", label: "Views", format: "number", align: "right" }, { key: "addToCart", label: "Added to bag", format: "number", align: "right" }],
        rows: data.topProducts,
        chart: { type: "bar", xKey: "name", series: [{ key: "views", label: "Views" }, { key: "addToCart", label: "Added to bag", color: "#8bd4f5" }] },
      }
    case "total-sales-over-time":
      return {
        ...base,
        summary: [{ label: "Total sales", value: data.metrics[2].value }, { label: "vs previous", value: data.metrics[2].change }],
        columns: [{ key: "date", label: "Date" }, { key: "orders", label: "Orders", format: "number", align: "right" }, { key: "sales", label: "Sales", format: "currency", align: "right" }, { key: "previousSales", label: "Previous period", format: "currency", align: "right" }],
        rows: timeRows,
        chart: { type: "line", xKey: "date", series: [{ key: "sales", label: data.range.currentLabel, format: "currency" }, { key: "previousSales", label: data.range.previousLabel, color: "#8bd4f5", format: "currency" }] },
      }
    case "orders-over-time":
      return {
        ...base,
        summary: [{ label: "Orders", value: data.metrics[3].value }, { label: "vs previous", value: data.metrics[3].change }],
        columns: [{ key: "date", label: "Date" }, { key: "orders", label: "Orders", format: "number", align: "right" }, { key: "previousOrders", label: "Previous period", format: "number", align: "right" }],
        rows: timeRows,
        chart: { type: "bar", xKey: "date", series: [{ key: "orders", label: "Orders" }] },
      }
    case "average-order-value":
      return {
        ...base,
        summary: [{ label: "Average order value", value: data.metrics[5].value }],
        columns: [{ key: "date", label: "Date" }, { key: "orders", label: "Orders", format: "number", align: "right" }, { key: "aov", label: "Average order value", format: "currency", align: "right" }],
        rows: timeRows.map((row) => ({ ...row, aov: row.orders ? Math.round(row.sales / row.orders) : 0 })),
        chart: { type: "line", xKey: "date", series: [{ key: "aov", label: "Average order value", format: "currency" }] },
      }
    case "sales-by-channel":
      return {
        ...base,
        summary: [{ label: "Attributed sales", value: money(data.channels.reduce((sum, row) => sum + row.sales, 0)) }],
        columns: [{ key: "label", label: "Traffic source" }, { key: "orders", label: "Orders", format: "number", align: "right" }, { key: "sales", label: "Sales", format: "currency", align: "right" }, { key: "conversionRate", label: "Conversion", format: "percent", align: "right" }],
        rows: [...data.channels].sort((a, b) => b.sales - a.sales),
        chart: { type: "bar", xKey: "label", series: [{ key: "sales", label: "Sales", format: "currency" }] },
      }
    case "sales-by-product":
      return {
        ...base,
        summary: [{ label: "Products sold", value: String(data.salesByProduct.length) }],
        columns: [{ key: "title", label: "Product" }, { key: "units", label: "Units", format: "number", align: "right" }, { key: "sales", label: "Sales", format: "currency", align: "right" }],
        rows: data.salesByProduct,
        chart: { type: "bar", xKey: "title", series: [{ key: "sales", label: "Sales", format: "currency" }] },
      }
    case "searches-by-query":
      return {
        ...base,
        summary: [{ label: "Distinct queries", value: String(data.topSearches.length) }],
        columns: [{ key: "query", label: "Search query" }, { key: "searches", label: "Searches", format: "number", align: "right" }, { key: "averageResults", label: "Avg. results", format: "number", align: "right" }],
        rows: data.topSearches,
        chart: { type: "bar", xKey: "query", series: [{ key: "searches", label: "Searches" }] },
      }
    case "searches-with-no-results":
      return {
        ...base,
        summary: [{ label: "Queries with no results", value: String(data.zeroResultSearches.length) }],
        columns: [{ key: "query", label: "Search query" }, { key: "searches", label: "Searches", format: "number", align: "right" }],
        rows: data.zeroResultSearches,
        chart: { type: "bar", xKey: "query", series: [{ key: "searches", label: "Searches" }] },
      }
    case "searches-over-time":
      return {
        ...base,
        summary: [{ label: "Searches", value: String(data.timeseries.reduce((sum, point) => sum + point.searches, 0)) }],
        columns: [{ key: "date", label: "Date" }, { key: "searches", label: "Searches", format: "number", align: "right" }],
        rows: timeRows,
        chart: { type: "line", xKey: "date", series: [{ key: "searches", label: "Searches" }] },
      }
    default:
      return null
  }
}
