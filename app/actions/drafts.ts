"use server"

import { permissionErrorMessage } from "@/lib/server/dal/auth"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { z } from "zod"

import { notifyDraftOrdersSent } from "@/lib/server/notifications"
import {
  convertDraftOrders,
  createDraftOrder,
  deleteDraftOrders,
  sendDraftOrders,
} from "@/lib/server/services/drafts"
import { orderCreateSchema, orderIdsSchema } from "@/lib/validations/order"

function revalidateDraftPaths(draftIds: string[] = [], customerIds: string[] = []) {
  revalidatePath("/dashboard/orders")
  revalidatePath("/dashboard/orders/drafts")
  revalidatePath("/dashboard/orders/drafts/new")
  revalidatePath("/dashboard/customers")

  for (const customerId of new Set(customerIds)) {
    revalidatePath(`/dashboard/customers/${customerId}`)
  }
  for (const draftId of new Set(draftIds)) {
    revalidatePath(`/dashboard/orders/drafts/${draftId}`)
  }
}

function mutationError(error: unknown) {
  const denied = permissionErrorMessage(error)
  if (denied) return denied
  if (error instanceof Error) {
    if (error.message === "Unauthorized") return "Sign in to continue."
    if (error.message === "Forbidden") return "Administrator access is required."
    if (error.message === "SuperAdminRequired") return "Only a full administrator can do this."
    if (
      error.message.includes("no longer exists") ||
      error.message.includes("cannot be added")
    ) {
      return error.message
    }
  }

  return "The draft order could not be updated. Try again."
}

export async function createDraftOrderAction(input: unknown) {
  const result = orderCreateSchema.safeParse(input)
  if (!result.success) {
    return {
      success: false,
      message: z.flattenError(result.error).formErrors[0] ?? "Check the draft order details.",
    }
  }

  try {
    const draft = await createDraftOrder(result.data)
    revalidateDraftPaths([draft.id], draft.userId ? [draft.userId] : [])
    return { success: true, draftId: draft.id, number: draft.number }
  } catch (error) {
    return { success: false, message: mutationError(error) }
  }
}

async function runBulkDraftAction(
  input: unknown,
  mutation: (draftIds: string[]) => Promise<{
    count: number
    draftIds: string[]
    customerIds: string[]
    orderIds?: string[]
  }>,
) {
  const result = orderIdsSchema.safeParse(input)
  if (!result.success) {
    return { success: false, message: "Select at least one draft order." }
  }

  try {
    const updated = await mutation([...new Set(result.data)])
    if (!updated.count) {
      return { success: false, message: "No selected draft orders are eligible for this action." }
    }
    revalidateDraftPaths(updated.draftIds, updated.customerIds)
    for (const orderId of updated.orderIds ?? []) {
      revalidatePath(`/dashboard/orders/${orderId}`)
    }
    return { success: true, count: updated.count, orderIds: updated.orderIds }
  } catch (error) {
    return { success: false, message: mutationError(error) }
  }
}

export async function sendDraftOrdersAction(input: unknown) {
  const result = await runBulkDraftAction(input, sendDraftOrders)
  if (result.success) {
    const ids = orderIdsSchema.safeParse(input)
    if (ids.success) {
      const draftIds = [...new Set(ids.data)]
      after(() => notifyDraftOrdersSent(draftIds))
    }
  }
  return result
}

export async function convertDraftOrdersAction(input: unknown) {
  return runBulkDraftAction(input, convertDraftOrders)
}

export async function deleteDraftOrdersAction(input: unknown) {
  const result = orderIdsSchema.safeParse(input)
  if (!result.success) {
    return { success: false, message: "Select at least one draft order." }
  }

  try {
    const deleted = await deleteDraftOrders([...new Set(result.data)])
    if (!deleted.count) {
      return { success: false, message: "No selected draft orders are eligible for deletion." }
    }
    revalidateDraftPaths(result.data)
    return { success: true, count: deleted.count }
  } catch (error) {
    return { success: false, message: mutationError(error) }
  }
}
