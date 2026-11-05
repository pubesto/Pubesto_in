import "server-only"

import { randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import { PutObjectCommand } from "@aws-sdk/client-s3"

import { getR2Env } from "@/lib/server/env"
import { getR2Client } from "@/lib/server/r2"

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/heic": "heic",
}

export function isR2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME &&
      process.env.R2_PUBLIC_URL,
  )
}

/**
 * Stores a file and returns its object key: Cloudflare R2 when configured,
 * otherwise public/uploads (development only — files written at runtime are
 * not served by a production build).
 */
export async function saveUpload(data: Uint8Array, contentType: string, folder: string): Promise<string> {
  const ext = EXTENSIONS[contentType] ?? "bin"
  const name = `${new Date().getUTCFullYear()}/${randomUUID()}.${ext}`

  if (isR2Configured()) {
    const env = getR2Env()
    const key = `${folder}/${name}`
    await getR2Client().send(
      new PutObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key, Body: data, ContentType: contentType }),
    )
    return key
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("File storage is not configured (set the R2_* environment variables).")
  }
  const key = `uploads/${folder}/${name}`
  const target = join(process.cwd(), "public", key)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, data)
  return key
}

/** Parses a data: URL from a browser upload. */
export function parseDataUrl(value: string): { contentType: string; data: Uint8Array } | null {
  const match = /^data:([\w/+.-]+);base64,([\s\S]+)$/.exec(String(value || ""))
  if (!match) return null
  return { contentType: match[1].toLowerCase(), data: new Uint8Array(Buffer.from(match[2], "base64")) }
}
