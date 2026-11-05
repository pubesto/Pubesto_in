"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { assertPermission, permissionErrorMessage } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"

const messageIdsSchema = z.array(z.string().min(1)).min(1).max(500)

const messageStatusSchema = z.object({
  ids: messageIdsSchema,
  status: z.enum(["NEW", "READ", "RESOLVED"]),
})

function mutationError(error: unknown) {
  return permissionErrorMessage(error) ?? "The message could not be updated. Try again."
}

export async function setMessageStatusAction(input: unknown) {
  const parsed = messageStatusSchema.safeParse(input)
  if (!parsed.success) return { success: false as const, message: "Select at least one message." }
  try {
    await assertPermission("messages.manage")
    const updated = await getPrisma().contactMessage.updateMany({
      where: { id: { in: [...new Set(parsed.data.ids)] } },
      data: { status: parsed.data.status },
    })
    if (!updated.count) return { success: false as const, message: "No selected messages are still available." }
    revalidatePath("/dashboard/messages")
    return { success: true as const, count: updated.count }
  } catch (error) {
    return { success: false as const, message: mutationError(error) }
  }
}

export async function deleteMessagesAction(input: unknown) {
  const parsed = messageIdsSchema.safeParse(input)
  if (!parsed.success) return { success: false as const, message: "Select at least one message." }
  try {
    await assertPermission("messages.manage")
    const deleted = await getPrisma().contactMessage.deleteMany({ where: { id: { in: [...new Set(parsed.data)] } } })
    if (!deleted.count) return { success: false as const, message: "No selected messages are still available." }
    revalidatePath("/dashboard/messages")
    return { success: true as const, count: deleted.count }
  } catch (error) {
    return { success: false as const, message: mutationError(error) }
  }
}
