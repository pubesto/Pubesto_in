import "server-only"

import { gunzipSync, gzipSync } from "node:zlib"

import { endOfDay, startOfDay, subDays } from "date-fns"

import type { Prisma } from "@/generated/prisma/client"
import { channelLabel } from "@/lib/analytics/channels"
import { deviceFromUserAgent } from "@/lib/server/analytics/track"
import { requirePermission } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"
import type { RecordingChunkInput, RecordingListFilter } from "@/lib/validations/analytics"

const MAX_RECORDING_BYTES = 8 * 1024 * 1024
const MAX_CHUNKS = 400

function stripQuery(path: string) {
  const index = path.indexOf("?")
  return index === -1 ? path : path.slice(0, index)
}

/**
 * Stores one rrweb batch. The first batch creates the recording; later ones
 * extend it. Oversized or runaway recordings are capped silently.
 */
export async function storeRecordingChunk(
  input: RecordingChunkInput,
  context: { userAgent: string | null; userId: string | null; country: string | null },
  isRetry = false,
): Promise<void> {
  const prisma = getPrisma()
  const device = deviceFromUserAgent(context.userAgent)
  if (device === "bot") return

  const json = JSON.stringify(input.events)
  const data = gzipSync(Buffer.from(json, "utf8"))
  const path = stripQuery(input.path).slice(0, 512)
  const firstTs = input.events[0]?.timestamp ?? Date.now()
  const lastTs = input.events[input.events.length - 1]?.timestamp ?? firstTs

  const existing = await prisma.sessionRecording.findUnique({
    where: { id: input.recordingId },
    select: { id: true, byteSize: true, chunkCount: true, startedAt: true, pagePaths: true },
  })

  if (existing) {
    if (existing.byteSize + data.byteLength > MAX_RECORDING_BYTES || existing.chunkCount >= MAX_CHUNKS) {
      return
    }
    await prisma.$transaction([
      prisma.sessionRecordingChunk.upsert({
        where: { recordingId_seq: { recordingId: existing.id, seq: input.seq } },
        create: {
          recordingId: existing.id,
          seq: input.seq,
          data,
          eventCount: input.events.length,
          byteSize: data.byteLength,
        },
        update: {},
      }),
      prisma.sessionRecording.update({
        where: { id: existing.id },
        data: {
          lastEventAt: new Date(lastTs),
          durationMs: Math.max(0, lastTs - existing.startedAt.getTime()),
          eventCount: { increment: input.events.length },
          chunkCount: { increment: 1 },
          byteSize: { increment: data.byteLength },
          pagePaths: existing.pagePaths.includes(path) ? undefined : { push: path },
          ...(context.userId ? { userId: context.userId } : {}),
        },
      }),
    ])
    return
  }

  try {
    await createRecording()
  } catch (error) {
    // The first two batches of a session often arrive together: both see no
    // recording and both try to create it. The loser appends to the winner's.
    if (!isRetry && (error as { code?: string })?.code === "P2002") {
      return storeRecordingChunk(input, context, true)
    }
    throw error
  }

  async function createRecording() {
    await prisma.sessionRecording.create({
      data: {
        id: input.recordingId,
        visitorId: input.visitorId,
        userId: context.userId,
        device,
        userAgent: context.userAgent?.slice(0, 512),
        country: context.country ?? undefined,
        firstPath: path,
        pagePaths: [path],
        startedAt: new Date(firstTs),
        lastEventAt: new Date(lastTs),
        durationMs: Math.max(0, lastTs - firstTs),
        eventCount: input.events.length,
        chunkCount: 1,
        byteSize: data.byteLength,
        chunks: {
          create: {
            seq: input.seq,
            data,
            eventCount: input.events.length,
            byteSize: data.byteLength,
          },
        },
      },
    })
  }

  await prisma.analyticsSession
    .updateMany({ where: { id: input.recordingId }, data: { recorded: true } })
    .catch(() => undefined)
}

export type RecordingListItem = {
  id: string
  startedAt: string
  durationMs: number
  device: string
  country: string | null
  firstPath: string
  pageCount: number
  pagePaths: string[]
  eventCount: number
  converted: boolean
  orderId: string | null
  channel: string
  channelLabel: string
  customerName: string | null
}

export type RecordingList = {
  items: RecordingListItem[]
  total: number
  page: number
  pageSize: number
  pathOptions: string[]
}

function resolveRange(filter: { from?: string; to?: string; days?: number }) {
  const to = filter.to ? endOfDay(new Date(filter.to)) : endOfDay(new Date())
  const from = filter.from ? startOfDay(new Date(filter.from)) : startOfDay(subDays(to, (filter.days ?? 30) - 1))
  return { from, to }
}

export async function listRecordings(filter: RecordingListFilter): Promise<RecordingList> {
  await requirePermission("analytics.view")
  const prisma = getPrisma()
  const { from, to } = resolveRange(filter)

  const where: Prisma.SessionRecordingWhereInput = {
    startedAt: { gte: from, lte: to },
    eventCount: { gt: 2 },
    ...(filter.device ? { device: filter.device } : {}),
    ...(filter.path ? { pagePaths: { has: filter.path } } : {}),
    ...(filter.converted ? { converted: true } : {}),
  }

  const [rows, total, pathGroups] = await Promise.all([
    prisma.sessionRecording.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
      select: {
        id: true,
        startedAt: true,
        durationMs: true,
        device: true,
        country: true,
        firstPath: true,
        pagePaths: true,
        eventCount: true,
        converted: true,
        orderId: true,
        userId: true,
      },
    }),
    prisma.sessionRecording.count({ where }),
    prisma.sessionRecording.findMany({
      where: { startedAt: { gte: from, lte: to } },
      select: { pagePaths: true },
      take: 2000,
    }),
  ])

  const sessionIds = rows.map((row) => row.id)
  const userIds = rows.map((row) => row.userId).filter((id): id is string => Boolean(id))
  const [sessions, users] = await Promise.all([
    sessionIds.length
      ? prisma.analyticsSession.findMany({
          where: { id: { in: sessionIds } },
          select: { id: true, channel: true },
        })
      : [],
    userIds.length
      ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
      : [],
  ])
  const channelById = new Map(sessions.map((session) => [session.id, session.channel]))
  const nameById = new Map(users.map((user) => [user.id, user.name]))

  const pathCounts = new Map<string, number>()
  for (const group of pathGroups) {
    for (const path of group.pagePaths) {
      pathCounts.set(path, (pathCounts.get(path) ?? 0) + 1)
    }
  }
  const pathOptions = [...pathCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([path]) => path)

  return {
    items: rows.map((row) => {
      const channel = channelById.get(row.id) ?? "direct"
      return {
        id: row.id,
        startedAt: row.startedAt.toISOString(),
        durationMs: row.durationMs,
        device: row.device,
        country: row.country,
        firstPath: row.firstPath,
        pageCount: row.pagePaths.length,
        pagePaths: row.pagePaths,
        eventCount: row.eventCount,
        converted: row.converted,
        orderId: row.orderId,
        channel,
        channelLabel: channelLabel(channel),
        customerName: row.userId ? nameById.get(row.userId) ?? null : null,
      }
    }),
    total,
    page: filter.page,
    pageSize: filter.pageSize,
    pathOptions,
  }
}

export type RecordingDetail = RecordingListItem & {
  userAgent: string | null
  landingReferrer: string | null
  source: string | null
}

export async function getRecordingDetail(id: string): Promise<RecordingDetail | null> {
  await requirePermission("analytics.view")
  const prisma = getPrisma()

  const row = await prisma.sessionRecording.findUnique({
    where: { id },
    select: {
      id: true,
      startedAt: true,
      durationMs: true,
      device: true,
      country: true,
      userAgent: true,
      firstPath: true,
      pagePaths: true,
      eventCount: true,
      converted: true,
      orderId: true,
      userId: true,
    },
  })
  if (!row) return null

  const [session, user] = await Promise.all([
    prisma.analyticsSession.findUnique({
      where: { id },
      select: { channel: true, source: true, referrer: true },
    }),
    row.userId ? prisma.user.findUnique({ where: { id: row.userId }, select: { name: true } }) : null,
  ])

  const channel = session?.channel ?? "direct"
  return {
    id: row.id,
    startedAt: row.startedAt.toISOString(),
    durationMs: row.durationMs,
    device: row.device,
    country: row.country,
    firstPath: row.firstPath,
    pageCount: row.pagePaths.length,
    pagePaths: row.pagePaths,
    eventCount: row.eventCount,
    converted: row.converted,
    orderId: row.orderId,
    channel,
    channelLabel: channelLabel(channel),
    customerName: user?.name ?? null,
    userAgent: row.userAgent,
    landingReferrer: session?.referrer ?? null,
    source: session?.source ?? null,
  }
}

/** Decompresses and concatenates every chunk, in order, for the player. */
export async function getRecordingEvents(id: string): Promise<unknown[]> {
  await requirePermission("analytics.view")
  const chunks = await getPrisma().sessionRecordingChunk.findMany({
    where: { recordingId: id },
    orderBy: { seq: "asc" },
    select: { data: true },
  })

  const events: unknown[] = []
  for (const chunk of chunks) {
    try {
      const parsed = JSON.parse(gunzipSync(Buffer.from(chunk.data)).toString("utf8")) as unknown[]
      events.push(...parsed)
    } catch (error) {
      console.error(`[recordings] corrupt chunk in ${id}`, error)
    }
  }
  return events
}

export async function markRecordingConverted(sessionId: string, orderId: string) {
  await getPrisma()
    .sessionRecording.updateMany({ where: { id: sessionId }, data: { converted: true, orderId } })
    .catch(() => undefined)
}

/** Deletes recordings older than the retention window. */
export async function pruneRecordings(retentionDays: number) {
  const cutoff = subDays(new Date(), retentionDays)
  const result = await getPrisma().sessionRecording.deleteMany({
    where: { startedAt: { lt: cutoff } },
  })
  return result.count
}
