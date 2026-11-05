import { subDays } from "date-fns"

import { pruneRecordings } from "@/lib/server/analytics/recordings"
import { getPrisma } from "@/lib/server/db"

export const dynamic = "force-dynamic"

/**
 * Retention job. Call from a cron (daily) with the MAINTENANCE_SECRET header:
 *
 *   curl -X POST https://pubesto.com/api/maintenance/cleanup \
 *     -H "x-maintenance-secret: $MAINTENANCE_SECRET"
 *
 * Recordings are kept RECORDING_RETENTION_DAYS (default 30), raw heatmap and
 * behaviour events ANALYTICS_RETENTION_DAYS (default 180). Session rows and
 * search logs are kept so long-term reports still work.
 */
export async function POST(request: Request) {
  const secret = process.env.MAINTENANCE_SECRET
  if (!secret || request.headers.get("x-maintenance-secret") !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const recordingDays = Number(process.env.RECORDING_RETENTION_DAYS ?? 30) || 30
  const eventDays = Number(process.env.ANALYTICS_RETENTION_DAYS ?? 180) || 180

  const prisma = getPrisma()
  const [recordings, events] = await Promise.all([
    pruneRecordings(recordingDays),
    prisma.analyticsEvent.deleteMany({
      where: { createdAt: { lt: subDays(new Date(), eventDays) } },
    }),
  ])

  return Response.json({
    ok: true,
    recordingsDeleted: recordings,
    eventsDeleted: events.count,
    recordingRetentionDays: recordingDays,
    analyticsRetentionDays: eventDays,
  })
}
