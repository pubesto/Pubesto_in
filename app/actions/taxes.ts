"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import {
  getMonthlyGstAnalytics,
  getTaxSettings,
  updateTaxSettings,
  type MonthlyGstAnalytics,
  type TaxSettingData,
} from "@/lib/server/dal/taxes"

const updateTaxSettingsSchema = z.object({
  originState: z.string().min(1, "Origin state is required"),
  gstin: z.string().optional(),
  defaultGstRate: z.number().min(0).max(100),
  priceInclusive: z.boolean(),
  defaultHsn: z.string().trim().max(10).default(""),
  legalName: z.string().trim().min(1, "Business name is required").max(160).optional(),
  businessAddress: z.string().trim().max(400).optional(),
})

export async function fetchMonthlyGstAnalyticsAction(
  year?: number
): Promise<{ success: boolean; data?: MonthlyGstAnalytics; error?: string }> {
  try {
    const data = await getMonthlyGstAnalytics(year)
    return { success: true, data }
  } catch (error) {
    console.error("Failed to load GST analytics:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load GST analytics",
    }
  }
}

export async function updateTaxSettingsAction(
  rawInput: unknown
): Promise<{ success: boolean; data?: TaxSettingData; error?: string }> {
  try {
    const parsed = updateTaxSettingsSchema.parse(rawInput)
    const updated = await updateTaxSettings(parsed)
    revalidatePath("/dashboard/taxes")
    revalidatePath("/dashboard/products")
    return { success: true, data: updated }
  } catch (error) {
    console.error("Failed to update tax settings:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update tax settings",
    }
  }
}

export async function fetchTaxSettingsAction(): Promise<{
  success: boolean
  data?: TaxSettingData
  error?: string
}> {
  try {
    const data = await getTaxSettings()
    return { success: true, data }
  } catch (error) {
    console.error("Failed to fetch tax settings:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load tax settings",
    }
  }
}
