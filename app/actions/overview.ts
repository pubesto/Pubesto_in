"use server"

import {
  getAdminOverviewData,
  type OverviewData,
  type OverviewDateRangeInput,
} from "@/lib/server/dal/overview"

export async function fetchOverviewDataAction(
  input?: OverviewDateRangeInput,
): Promise<{ success: boolean; data?: OverviewData; error?: string }> {
  try {
    const data = await getAdminOverviewData(input)
    return { success: true, data }
  } catch (error) {
    console.error("Failed to load overview data:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load dashboard data",
    }
  }
}
