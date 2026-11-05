import { hasPermission } from "@/lib/permissions"
import { getRecordingEvents } from "@/lib/server/analytics/recordings"
import { getCurrentUser } from "@/lib/server/dal/auth"

export const dynamic = "force-dynamic"

/**
 * Streams a recording's events to the dashboard player. Staff with the
 * analytics permission only.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!hasPermission(user, "analytics.view")) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await context.params
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const events = await getRecordingEvents(id)
  if (!events.length) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  return Response.json(
    { id, events },
    { headers: { "Cache-Control": "private, max-age=300" } },
  )
}
