import { z } from "zod"

import {
  BANNER_VIDEO_CONTENT_TYPES,
  isBannerVideoContentType,
  MAX_BANNER_IMAGE_BYTES,
  MAX_BANNER_VIDEO_BYTES,
} from "@/lib/banner-media"
import { productImageObjectKeySchema } from "@/lib/validations/product"

export const imageContentTypeSchema = z.enum([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
])

/** Images everywhere, plus MP4/WebM video for banners only. */
export const uploadContentTypeSchema = z.enum([
  ...imageContentTypeSchema.options,
  ...BANNER_VIDEO_CONTENT_TYPES,
])

export const localImageObjectKeySchema = z
  .string()
  .regex(
    /^uploads\/(?:(?:products|categories|collections|banners)\/\d{4}\/[0-9a-f-]{36}\.(?:avif|jpg|png|webp)|banners\/\d{4}\/[0-9a-f-]{36}\.(?:mp4|webm))$/,
    "Invalid local image key",
  )

const imageUploadBaseSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: imageContentTypeSchema,
  size: z.number().int().positive().max(10 * 1024 * 1024).optional(),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024).optional(),
})

export const imageUploadSchema = imageUploadBaseSchema
  .refine((data) => data.size !== undefined || data.sizeBytes !== undefined, {
    message: "Image size is required",
    path: ["size"],
  })
  .transform((data) => ({
    filename: data.filename,
    contentType: data.contentType,
    size: (data.size ?? data.sizeBytes) as number,
  }))

export const productImageUploadSchema = imageUploadSchema

export const imageUploadRequestSchema = imageUploadBaseSchema
  .extend({
    contentType: uploadContentTypeSchema,
    size: z.number().int().positive().max(MAX_BANNER_VIDEO_BYTES).optional(),
    sizeBytes: z.number().int().positive().max(MAX_BANNER_VIDEO_BYTES).optional(),
    scope: z.enum(["product", "category", "collection", "banner"]).default("product"),
  })
  .refine((data) => data.size !== undefined || data.sizeBytes !== undefined, {
    message: "Image size is required",
    path: ["size"],
  })
  .refine((data) => !isBannerVideoContentType(data.contentType) || data.scope === "banner", {
    message: "Videos can only be uploaded for banners.",
    path: ["contentType"],
  })
  .refine(
    (data) =>
      isBannerVideoContentType(data.contentType) ||
      (data.size ?? data.sizeBytes ?? 0) <= MAX_BANNER_IMAGE_BYTES,
    { message: "Images must be 10 MB or smaller.", path: ["size"] },
  )
  .transform((data) => ({
    filename: data.filename,
    contentType: data.contentType,
    scope: data.scope,
    size: (data.size ?? data.sizeBytes) as number,
  }))

export type ImageUploadRequest = z.infer<typeof imageUploadRequestSchema>

export const attachProductImageSchema = z.object({
  productId: z.string().min(1),
  objectKey: productImageObjectKeySchema,
  altText: z.string().trim().max(300).nullable().optional(),
})
