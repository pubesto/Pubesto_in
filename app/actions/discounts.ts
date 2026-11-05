"use server"

import { permissionErrorMessage } from "@/lib/server/dal/auth"
import { revalidatePath } from "next/cache"
import { Prisma } from "@/generated/prisma/client"
import {
  createDiscount,
  deleteDiscounts,
  setDiscountStatus,
  updateDiscount,
} from "@/lib/server/services/discounts"
import {
  discountIdsSchema,
  discountInputSchema,
  discountStatusChangeSchema,
  discountUpdateSchema,
} from "@/lib/validations/discount"

function revalidateDiscountPaths(ids: string[] = []) {
  revalidatePath("/dashboard/discounts")
  revalidatePath("/dashboard/discounts/new")
  revalidatePath("/dashboard/discounts/amount-off-order")
  revalidatePath("/dashboard/discounts/buy-x-get-y")
  revalidatePath("/dashboard/discounts/free-shipping")
  for (const id of new Set(ids)) {
    revalidatePath(`/dashboard/discounts/${id}`)
  }
}

function mutationError(error: unknown) {
  const denied = permissionErrorMessage(error)
  if (denied) return denied
  if (error instanceof Error) {
    if (error.message === "Unauthorized") return "Sign in to continue."
    if (error.message === "Forbidden") return "Administrator access is required."
    if (error.message === "SuperAdminRequired") return "Only a full administrator can do this."
    if (error.message.includes("no longer")) return error.message
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return "That discount code is already in use."
  }
  return "The discount could not be updated. Try again."
}

export async function createDiscountAction(input: unknown) {
  const parsed = discountInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Check the discount details." }
  }
  try {
    const discount = await createDiscount(parsed.data)
    revalidateDiscountPaths([discount.id])
    return { success: true, id: discount.id }
  } catch (error) {
    return { success: false, message: mutationError(error) }
  }
}

export async function updateDiscountAction(input: unknown) {
  const parsed = discountUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Check the discount details." }
  }
  try {
    const { id, ...data } = parsed.data
    const discount = await updateDiscount(id, data)
    revalidateDiscountPaths([discount.id])
    return { success: true, id: discount.id }
  } catch (error) {
    return { success: false, message: mutationError(error) }
  }
}

export async function setDiscountStatusAction(input: unknown) {
  const parsed = discountStatusChangeSchema.safeParse(input)
  if (!parsed.success) return { success: false, message: "Select at least one discount." }
  try {
    const updated = await setDiscountStatus([...new Set(parsed.data.ids)], parsed.data.status)
    if (!updated.count) return { success: false, message: "No selected discounts are still available." }
    revalidateDiscountPaths(updated.ids)
    return { success: true, count: updated.count }
  } catch (error) {
    return { success: false, message: mutationError(error) }
  }
}

export async function deleteDiscountsAction(input: unknown) {
  const parsed = discountIdsSchema.safeParse(input)
  if (!parsed.success) return { success: false, message: "Select at least one discount." }
  try {
    const deleted = await deleteDiscounts([...new Set(parsed.data)])
    if (!deleted.count) return { success: false, message: "No selected discounts are still available." }
    revalidateDiscountPaths(deleted.ids)
    return { success: true, count: deleted.count }
  } catch (error) {
    return { success: false, message: mutationError(error) }
  }
}
