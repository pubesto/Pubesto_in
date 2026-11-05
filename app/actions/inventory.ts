"use server"

import { permissionErrorMessage } from "@/lib/server/dal/auth"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import {
  importInventoryQuantities,
  updateInventoryQuantities,
} from "@/lib/server/services/inventory"
import {
  inventoryAdjustmentSchema,
  inventoryBulkAdjustmentSchema,
  inventoryImportSchema,
} from "@/lib/validations/inventory"

function revalidateInventoryPaths(productIds: string[]) {
  revalidatePath("/dashboard/products/inventory")
  revalidatePath("/dashboard/products")
  revalidatePath("/dashboard/products/[productId]", "page")

  for (const productId of new Set(productIds)) {
    revalidatePath(`/dashboard/products/${productId}`)
  }
}

function mutationError(error: unknown) {
  const denied = permissionErrorMessage(error)
  if (denied) return denied
  if (error instanceof Error) {
    if (error.message === "Unauthorized") return "Sign in to continue."
    if (error.message === "Forbidden") return "Administrator access is required."
    if (error.message === "SuperAdminRequired") return "Only a full administrator can do this."
    if (error.message.includes("no longer exist") || error.message.includes("No product variant")) {
      return error.message
    }
  }

  return "Inventory could not be updated. Try again."
}

export async function updateInventoryQuantityAction(input: unknown) {
  const result = inventoryAdjustmentSchema.safeParse(input)
  if (!result.success) {
    return {
      success: false,
      message: z.flattenError(result.error).formErrors[0] ?? "Enter a valid inventory quantity.",
    }
  }

  try {
    const updated = await updateInventoryQuantities([result.data])
    revalidateInventoryPaths(updated.productIds)
    return { success: true, count: updated.count }
  } catch (error) {
    return { success: false, message: mutationError(error) }
  }
}

export async function updateInventoryQuantitiesAction(input: unknown) {
  const result = inventoryBulkAdjustmentSchema.safeParse(input)
  if (!result.success) {
    return {
      success: false,
      message: z.flattenError(result.error).formErrors[0] ?? "Enter valid inventory quantities.",
    }
  }

  try {
    const updated = await updateInventoryQuantities(result.data)
    revalidateInventoryPaths(updated.productIds)
    return { success: true, count: updated.count }
  } catch (error) {
    return { success: false, message: mutationError(error) }
  }
}

export async function importInventoryAction(input: unknown) {
  const result = inventoryImportSchema.safeParse(input)
  if (!result.success) {
    return {
      success: false,
      message: z.flattenError(result.error).formErrors[0] ?? "Check the inventory CSV values.",
    }
  }

  try {
    const updated = await importInventoryQuantities(result.data)
    revalidateInventoryPaths(updated.productIds)
    return { success: true, count: updated.count }
  } catch (error) {
    return { success: false, message: mutationError(error) }
  }
}
