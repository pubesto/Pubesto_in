import { z } from "zod"

const idSchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/)

export const analyticsEventTypeSchema = z.enum([
  "PAGE_VIEW",
  "PRODUCT_VIEW",
  "ADD_TO_CART",
  "BEGIN_CHECKOUT",
  "PURCHASE",
  "SEARCH",
  "CLICK",
  "SCROLL",
  "MOVE",
  "CUSTOM",
])

export const analyticsEventSchema = z.object({
  type: analyticsEventTypeSchema,
  path: z.string().min(1).max(512),
  name: z.string().max(200).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  referrer: z.string().max(1024).optional(),
  ts: z.number().int().positive().optional(),
})

export const trackPayloadSchema = z.object({
  sessionId: idSchema,
  visitorId: idSchema,
  events: z.array(analyticsEventSchema).min(1).max(60),
})

export type TrackPayload = z.infer<typeof trackPayloadSchema>
export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>

/** One rrweb batch from the storefront recorder. */
export const recordingChunkSchema = z.object({
  recordingId: idSchema,
  visitorId: idSchema,
  seq: z.number().int().min(0).max(100_000),
  path: z.string().min(1).max(512),
  events: z
    .array(
      z.object({
        type: z.number().int(),
        timestamp: z.number(),
        data: z.unknown(),
      }),
    )
    .min(1)
    .max(5_000),
})

export type RecordingChunkInput = z.infer<typeof recordingChunkSchema>

export const recordingListFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  days: z.number().int().min(1).max(365).optional(),
  device: z.enum(["desktop", "mobile", "tablet"]).optional(),
  path: z.string().max(512).optional(),
  converted: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(100).default(25),
})

export type RecordingListFilter = z.infer<typeof recordingListFilterSchema>

export const heatmapFilterSchema = z.object({
  path: z.string().min(1).max(512),
  device: z.enum(["all", "desktop", "mobile", "tablet"]).default("all"),
  from: z.string().optional(),
  to: z.string().optional(),
  days: z.number().int().min(1).max(365).optional(),
})

export type HeatmapFilter = z.infer<typeof heatmapFilterSchema>

export const analyticsRangeSchema = z.object({
  preset: z.string().max(40).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  days: z.number().int().min(1).max(365).optional(),
})

export type AnalyticsRangeInput = z.infer<typeof analyticsRangeSchema>
