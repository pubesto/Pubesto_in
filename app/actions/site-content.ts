"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { permissionErrorMessage } from "@/lib/server/dal/auth"
import { resetSiteContentSection, saveSiteContentSection } from "@/lib/server/dal/site-content"
import type { SiteContent, SiteContentKey } from "@/lib/site-content"
import { siteContentKeySchema, siteContentSchemas } from "@/lib/validations/site-content"

const STOREFRONT_PATHS = [
  "/",
  "/contact",
  "/privacy",
  "/terms",
  "/returns",
  "/returns-policy",
  "/size-guide",
  "/collections",
  "/products/[slug]",
  "/dashboard/content",
]

function revalidateStorefront() {
  for (const path of STOREFRONT_PATHS) {
    revalidatePath(path, path.includes("[") ? "page" : undefined)
  }
  revalidatePath("/", "layout")
}

function firstIssue(error: z.ZodError) {
  const flat = z.flattenError(error)
  return flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat().find(Boolean)
}

export async function saveSiteContentAction(input: { key: unknown; value: unknown }) {
  const keyResult = siteContentKeySchema.safeParse(input.key)
  if (!keyResult.success) {
    return { success: false as const, message: "Unknown content section." }
  }
  const key = keyResult.data as SiteContentKey
  const valueResult = siteContentSchemas[key].safeParse(input.value)
  if (!valueResult.success) {
    return {
      success: false as const,
      message: firstIssue(valueResult.error) ?? "Check the content and try again.",
    }
  }

  try {
    await saveSiteContentSection(key, valueResult.data as SiteContent[typeof key])
    revalidateStorefront()
    return { success: true as const }
  } catch (error) {
    const denied = permissionErrorMessage(error)
    if (denied) return { success: false as const, message: denied }
    console.error("[site-content] save failed", error)
    return { success: false as const, message: "The content could not be saved. Try again." }
  }
}

export async function resetSiteContentAction(input: { key: unknown }) {
  const keyResult = siteContentKeySchema.safeParse(input.key)
  if (!keyResult.success) {
    return { success: false as const, message: "Unknown content section." }
  }

  try {
    await resetSiteContentSection(keyResult.data as SiteContentKey)
    revalidateStorefront()
    return { success: true as const }
  } catch (error) {
    const denied = permissionErrorMessage(error)
    if (denied) return { success: false as const, message: denied }
    console.error("[site-content] reset failed", error)
    return { success: false as const, message: "The content could not be reset. Try again." }
  }
}
