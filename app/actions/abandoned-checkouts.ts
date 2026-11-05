"use server"

import { permissionErrorMessage } from "@/lib/server/dal/auth"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { z } from "zod"

import { notifyOrderEvents } from "@/lib/server/notifications"
import {
  clearAbandonedCheckouts,
  recoverAbandonedCheckouts,
} from "@/lib/server/services/abandoned-checkouts"

const cartIdsSchema = z
  .array(z.string().trim().min(1))
  .min(1, "Select at least one checkout.")
  .max(100, "Update up to 100 checkouts at a time.")

function revalidateCheckoutPaths(cartIds: string[] = [], customerIds: string[] = [], orderIds: string[] = []) {
  revalidatePath("/dashboard/orders")
  revalidatePath("/dashboard/orders/abandoned-checkouts")
  revalidatePath("/dashboard/customers")

  for (const cartId of new Set(cartIds)) {
    revalidatePath(`/dashboard/orders/abandoned-checkouts/${cartId}`)
  }
  for (const customerId of new Set(customerIds)) {
    revalidatePath(`/dashboard/customers/${customerId}`)
  }
  for (const orderId of new Set(orderIds)) {
    revalidatePath(`/dashboard/orders/${orderId}`)
  }
}

function mutationError(error: unknown) {
  const denied = permissionErrorMessage(error)
  if (denied) return denied
  if (error instanceof Error) {
    if (error.message === "Unauthorized") return "Sign in to continue."
    if (error.message === "Forbidden") return "Administrator access is required."
    if (error.message === "SuperAdminRequired") return "Only a full administrator can do this."
  }

  return "The abandoned checkout could not be updated. Try again."
}

async function runCheckoutAction(
  input: unknown,
  mutation: (cartIds: string[]) => Promise<{
    count: number
    cartIds: string[]
    customerIds: string[]
    orderIds?: string[]
  }>,
) {
  const result = cartIdsSchema.safeParse(input)
  if (!result.success) {
    return { success: false, message: z.flattenError(result.error).formErrors[0] ?? "Select at least one checkout." }
  }

  try {
    const updated = await mutation([...new Set(result.data)])
    if (!updated.count) {
      return { success: false, message: "No selected checkouts are still available." }
    }
    revalidateCheckoutPaths(updated.cartIds, updated.customerIds, updated.orderIds)
    return { success: true, count: updated.count, orderIds: updated.orderIds }
  } catch (error) {
    return { success: false, message: mutationError(error) }
  }
}

export async function recoverAbandonedCheckoutsAction(input: unknown) {
  const result = await runCheckoutAction(input, recoverAbandonedCheckouts)
  if (result.success && result.orderIds?.length) {
    const orderIds = result.orderIds
    after(() => notifyOrderEvents(orderIds, "ORDER_PLACED"))
  }
  return result
}

export async function clearAbandonedCheckoutsAction(input: unknown) {
  return runCheckoutAction(input, clearAbandonedCheckouts)
}
