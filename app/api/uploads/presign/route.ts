import { randomUUID } from "node:crypto"

import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import { hasPermission, type PermissionKey } from "@/lib/permissions"
import { getCurrentUser } from "@/lib/server/dal/auth"
import { getR2Env } from "@/lib/server/env"
import { getR2Client } from "@/lib/server/r2"
import {
  imageUploadRequestSchema,
  type ImageUploadRequest,
} from "@/lib/validations/upload"

const extensionByContentType = {
  "image/avif": "avif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
} as const

function createLocalUploadResponse(input: ImageUploadRequest) {
  const extension = extensionByContentType[input.contentType]
  const folder = input.scope === "category"
    ? "categories"
    : input.scope === "collection"
      ? "collections"
      : input.scope === "banner"
        ? "banners"
        : "products"
  const objectKey = `uploads/${folder}/${new Date().getUTCFullYear()}/${randomUUID()}.${extension}`
  const uploadUrl = new URL("/api/uploads/local", "http://localhost")
  uploadUrl.searchParams.set("objectKey", objectKey)
  uploadUrl.searchParams.set("contentType", input.contentType)

  return Response.json({
    objectKey,
    uploadUrl: `${uploadUrl.pathname}${uploadUrl.search}`,
    publicUrl: `/${objectKey}`,
    expiresIn: 5 * 60,
  })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (user.role !== "ADMIN" && user.role !== "SUB_ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const input = imageUploadRequestSchema.safeParse(payload)

  if (!input.success) {
    return Response.json(
      {
        error: input.error.issues[0]?.message || "Invalid upload request",
        details: input.error.flatten(),
      },
      { status: 400 },
    )
  }

  const scopePermission: Record<string, PermissionKey> = {
    product: "products.manage",
    category: "categories.manage",
    collection: "collections.manage",
    banner: "banners.manage",
  }
  const requiredPermission = scopePermission[input.data.scope] ?? "products.manage"
  if (!hasPermission(user, requiredPermission)) {
    return Response.json(
      { error: `You don't have the "${requiredPermission}" permission.` },
      { status: 403 },
    )
  }

  let env: ReturnType<typeof getR2Env>
  try {
    env = getR2Env()
  } catch {
    if (process.env.NODE_ENV === "development") {
      return createLocalUploadResponse(input.data)
    }

    return Response.json(
      {
        error:
          "Image storage is not configured. Set a valid R2_PUBLIC_URL before uploading images.",
      },
      { status: 503 },
    )
  }
  const extension = extensionByContentType[input.data.contentType]
  const folder = input.data.scope === "category"
    ? "categories"
    : input.data.scope === "collection"
      ? "collections"
      : input.data.scope === "banner"
        ? "banners"
        : "products"
  const objectKey = `${folder}/${new Date().getUTCFullYear()}/${randomUUID()}.${extension}`

  let uploadUrl: string
  try {
    uploadUrl = await getSignedUrl(
      getR2Client(),
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: objectKey,
        ContentType: input.data.contentType,
      }),
      { expiresIn: 5 * 60 },
    )
  } catch {
    return Response.json(
      { error: "Upload service unavailable" },
      { status: 503 },
    )
  }

  return Response.json({
    objectKey,
    uploadUrl,
    publicUrl: `${env.R2_PUBLIC_URL.replace(/\/$/, "")}/${objectKey}`,
    expiresIn: 5 * 60,
  })
}
