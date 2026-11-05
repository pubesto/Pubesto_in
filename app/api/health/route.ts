import { getPrisma } from "@/lib/server/db"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await getPrisma().$queryRaw`SELECT 1`
    return Response.json({ status: "ok" })
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 })
  }
}
