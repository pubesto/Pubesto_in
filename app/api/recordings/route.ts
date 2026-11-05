import { after } from "next/server"

import { storeRecordingChunk } from "@/lib/server/analytics/recordings"
import { getCurrentUser } from "@/lib/server/dal/auth"
import { recordingChunkSchema } from "@/lib/validations/analytics"

export const dynamic = "force-dynamic"

const MAX_BODY_BYTES = 1_500_000

const noContent = () => new Response(null, { status: 204 })

/**
 * Receives rrweb event batches from the storefront recorder. Responds at once
 * and compresses/stores the batch after the response.
 */
export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0)
  if (length > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 })
  }

  let payload: unknown
  try {
    const text = await request.text()
    if (text.length > MAX_BODY_BYTES) return new Response(null, { status: 413 })
    payload = JSON.parse(text)
  } catch {
    return noContent()
  }

  const result = recordingChunkSchema.safeParse(payload)
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

  after(async () => {
    try {
      await storeRecordingChunk(result.data, { userAgent, userId, country })
    } catch (error) {
      console.error("[recordings] failed to store chunk", error)
    }
  })

  return noContent()
}
