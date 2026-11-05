"use server"

import { listRecordings, type RecordingList } from "@/lib/server/analytics/recordings"
import { getReport, getStoreAnalytics, type StoreAnalytics } from "@/lib/server/dal/analytics"
import { permissionErrorMessage } from "@/lib/server/dal/auth"
import { getHeatmapData, listHeatmapPages, type HeatmapData, type HeatmapPageOption } from "@/lib/server/dal/heatmaps"
import type { ReportResult } from "@/lib/analytics/reports"
import {
  analyticsRangeSchema,
  heatmapFilterSchema,
  recordingListFilterSchema,
} from "@/lib/validations/analytics"

type Result<T> = { success: true; data: T } | { success: false; message: string }

function failure(error: unknown, fallback: string): { success: false; message: string } {
  const denied = permissionErrorMessage(error)
  if (denied) return { success: false, message: denied }
  console.error(fallback, error)
  return { success: false, message: fallback }
}

export async function fetchAnalyticsAction(input: unknown): Promise<Result<StoreAnalytics>> {
  const range = analyticsRangeSchema.safeParse(input ?? {})
  if (!range.success) return { success: false, message: "Choose a valid date range." }
  try {
    return { success: true, data: await getStoreAnalytics(range.data) }
  } catch (error) {
    return failure(error, "Analytics could not be loaded.")
  }
}

export async function fetchReportAction(slug: string, input: unknown): Promise<Result<ReportResult>> {
  const range = analyticsRangeSchema.safeParse(input ?? {})
  if (!range.success) return { success: false, message: "Choose a valid date range." }
  try {
    const report = await getReport(slug, range.data)
    if (!report) return { success: false, message: "That report does not exist." }
    return { success: true, data: report }
  } catch (error) {
    return failure(error, "The report could not be loaded.")
  }
}

export async function listRecordingsAction(input: unknown): Promise<Result<RecordingList>> {
  const filter = recordingListFilterSchema.safeParse(input ?? {})
  if (!filter.success) return { success: false, message: "Check the recording filters." }
  try {
    return { success: true, data: await listRecordings(filter.data) }
  } catch (error) {
    return failure(error, "Recordings could not be loaded.")
  }
}

export async function fetchHeatmapAction(input: unknown): Promise<Result<HeatmapData>> {
  const filter = heatmapFilterSchema.safeParse(input ?? {})
  if (!filter.success) return { success: false, message: "Choose a page to view." }
  try {
    return { success: true, data: await getHeatmapData(filter.data) }
  } catch (error) {
    return failure(error, "The heatmap could not be loaded.")
  }
}

export async function listHeatmapPagesAction(input: unknown): Promise<Result<HeatmapPageOption[]>> {
  const range = analyticsRangeSchema.safeParse(input ?? {})
  if (!range.success) return { success: false, message: "Choose a valid date range." }
  try {
    return { success: true, data: await listHeatmapPages(range.data) }
  } catch (error) {
    return failure(error, "Pages could not be loaded.")
  }
}
