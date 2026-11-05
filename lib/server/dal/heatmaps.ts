import "server-only"

import { endOfDay, startOfDay, subDays } from "date-fns"

import type { Prisma } from "@/generated/prisma/client"
import { requirePermission } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"
import type { HeatmapFilter } from "@/lib/validations/analytics"

export type HeatmapClick = {
  /** Document x as a fraction of document width (0..1). */
  fx: number
  /** Document y as a fraction of document height (0..1). */
  fy: number
  /** Raw numbers so the overlay can rescale to the preview frame. */
  x: number
  y: number
  vw: number
  dh: number
  target: string | null
}

export type HeatmapMoveCell = { fx: number; fy: number; weight: number }

export type HeatmapData = {
  path: string
  device: string
  range: { from: string; to: string }
  sessions: number
  pageViews: number
  clicks: HeatmapClick[]
  topTargets: Array<{ target: string; clicks: number }>
  /** Share of page visits that scrolled at least to each 10 percent band. */
  scrollDepth: Array<{ band: number; share: number }>
  moves: HeatmapMoveCell[]
  /** Median document height / viewport width seen, used to size the preview. */
  typicalViewportWidth: number
  typicalDocumentHeight: number
}

export type HeatmapPageOption = { path: string; views: number }

function resolveRange(filter: { from?: string; to?: string; days?: number }) {
  const to = filter.to ? endOfDay(new Date(filter.to)) : endOfDay(new Date())
  const from = filter.from ? startOfDay(new Date(filter.from)) : startOfDay(subDays(to, (filter.days ?? 30) - 1))
  return { from, to }
}

function median(values: number[], fallback: number) {
  if (!values.length) return fallback
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function num(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

export async function listHeatmapPages(filter: { from?: string; to?: string; days?: number }): Promise<HeatmapPageOption[]> {
  await requirePermission("analytics.view")
  const { from, to } = resolveRange(filter)
  const groups = await getPrisma().analyticsEvent.groupBy({
    by: ["path"],
    where: { type: "PAGE_VIEW", createdAt: { gte: from, lte: to } },
    _count: { _all: true },
    orderBy: { _count: { path: "desc" } },
    take: 60,
  })
  return groups.map((group) => ({ path: group.path, views: group._count._all }))
}

export async function getHeatmapData(filter: HeatmapFilter): Promise<HeatmapData> {
  await requirePermission("analytics.view")
  const prisma = getPrisma()
  const { from, to } = resolveRange(filter)

  const sessionFilter: Prisma.AnalyticsSessionWhereInput | undefined =
    filter.device === "all" ? undefined : { device: filter.device }

  const baseWhere: Prisma.AnalyticsEventWhereInput = {
    path: filter.path,
    createdAt: { gte: from, lte: to },
    ...(sessionFilter ? { session: sessionFilter } : {}),
  }

  const [pageViews, sessionGroups, clickRows, scrollRows, moveRows] = await Promise.all([
    prisma.analyticsEvent.count({ where: { ...baseWhere, type: "PAGE_VIEW" } }),
    prisma.analyticsEvent.groupBy({ by: ["sessionId"], where: { ...baseWhere, type: "PAGE_VIEW" } }),
    prisma.analyticsEvent.findMany({
      where: { ...baseWhere, type: "CLICK" },
      orderBy: { createdAt: "desc" },
      take: 6000,
      select: { name: true, payload: true },
    }),
    prisma.analyticsEvent.findMany({
      where: { ...baseWhere, type: "SCROLL" },
      orderBy: { createdAt: "desc" },
      take: 6000,
      select: { payload: true },
    }),
    prisma.analyticsEvent.findMany({
      where: { ...baseWhere, type: "MOVE" },
      orderBy: { createdAt: "desc" },
      take: 1500,
      select: { payload: true },
    }),
  ])

  const widths: number[] = []
  const heights: number[] = []

  const clicks: HeatmapClick[] = []
  const targetCounts = new Map<string, number>()
  for (const row of clickRows) {
    const payload = (row.payload ?? {}) as Record<string, unknown>
    const x = num(payload.x)
    const y = num(payload.y)
    const vw = num(payload.vw)
    const dw = num(payload.dw, vw)
    const dh = num(payload.dh)
    if (!vw || !dh) continue
    widths.push(vw)
    heights.push(dh)
    clicks.push({
      fx: Math.max(0, Math.min(1, x / (dw || vw))),
      fy: Math.max(0, Math.min(1, y / dh)),
      x,
      y,
      vw,
      dh,
      target: row.name,
    })
    if (row.name) {
      targetCounts.set(row.name, (targetCounts.get(row.name) ?? 0) + 1)
    }
  }

  const bands = Array.from({ length: 10 }, (_, index) => (index + 1) * 10)
  const reached = new Array(10).fill(0)
  let scrollSamples = 0
  for (const row of scrollRows) {
    const payload = (row.payload ?? {}) as Record<string, unknown>
    const depth = num(payload.depth)
    if (!depth) continue
    scrollSamples += 1
    bands.forEach((band, index) => {
      if (depth >= band - 0.5) reached[index] += 1
    })
    widths.push(num(payload.vw))
    heights.push(num(payload.dh))
  }

  const moveAggregate = new Map<string, HeatmapMoveCell>()
  for (const row of moveRows) {
    const payload = (row.payload ?? {}) as Record<string, unknown>
    const cell = num(payload.cell, 40)
    const dw = num(payload.dw, num(payload.vw))
    const dh = num(payload.dh)
    const cells = Array.isArray(payload.cells) ? (payload.cells as unknown[]) : []
    if (!dw || !dh) continue
    for (const entry of cells) {
      if (!Array.isArray(entry) || entry.length < 3) continue
      const [cx, cy, count] = entry as [number, number, number]
      const fx = Math.max(0, Math.min(1, ((cx + 0.5) * cell) / dw))
      const fy = Math.max(0, Math.min(1, ((cy + 0.5) * cell) / dh))
      const key = `${Math.round(fx * 60)}:${Math.round(fy * 200)}`
      const existing = moveAggregate.get(key)
      if (existing) {
        existing.weight += count
      } else {
        moveAggregate.set(key, { fx, fy, weight: count })
      }
    }
  }

  const moves = [...moveAggregate.values()].sort((a, b) => b.weight - a.weight).slice(0, 2500)

  return {
    path: filter.path,
    device: filter.device,
    range: { from: from.toISOString(), to: to.toISOString() },
    sessions: sessionGroups.length,
    pageViews,
    clicks,
    topTargets: [...targetCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([target, count]) => ({ target, clicks: count })),
    scrollDepth: bands.map((band, index) => ({
      band,
      share: scrollSamples ? Math.round((reached[index] / scrollSamples) * 100) : 0,
    })),
    moves,
    typicalViewportWidth: median(widths.filter(Boolean), filter.device === "mobile" ? 390 : 1280),
    typicalDocumentHeight: median(heights.filter(Boolean), 2400),
  }
}
