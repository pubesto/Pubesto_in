"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { Prisma } from "@/generated/prisma/client"
import { assertPermission, permissionErrorMessage } from "@/lib/server/dal/auth"
import { parseTimeline, type RequestTimelineEntry } from "@/lib/server/dal/returns"
import { getPrisma } from "@/lib/server/db"
import {
  CANCELLATION_STATUSES,
  CANCELLATION_STATUS_LABELS,
  CANCELLATION_STATUS_NOTES,
  RETURN_STATUSES,
  RETURN_STATUS_LABELS,
  RETURN_STATUS_NOTES,
} from "@/lib/support-requests"

const noteSchema = z.string().trim().max(2000, "Notes must be at most 2000 characters.").default("")

const returnUpdateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(RETURN_STATUSES),
  adminNotes: noteSchema,
  adminInternalNotes: noteSchema,
  rejectionReason: z.string().trim().max(1000, "The rejection reason must be at most 1000 characters.").default(""),
})

const cancellationUpdateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(CANCELLATION_STATUSES),
  adminNotes: noteSchema,
  adminInternalNotes: noteSchema,
})

class RequestNotFoundError extends Error {}

function revalidateReturnPaths() {
  revalidatePath("/dashboard/returns")
}

function mutationError(error: unknown) {
  const denied = permissionErrorMessage(error)
  if (denied) return denied
  if (error instanceof RequestNotFoundError) return error.message
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return "That request no longer exists."
  }
  return "The request could not be updated. Try again."
}

/**
 * Saves notes and, when the status changes, appends a customer-visible
 * timeline entry. The entry's note is the customer note when it was edited in
 * this save, otherwise the standard copy for the new status.
 */
export async function updateReturnRequestAction(input: unknown) {
  const parsed = returnUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false as const, message: parsed.error.issues[0]?.message ?? "Check the return details." }
  }
  const { id, status, adminNotes, adminInternalNotes, rejectionReason } = parsed.data
  if (status === "rejected" && !rejectionReason) {
    return { success: false as const, message: "Add a rejection reason so the customer knows why." }
  }

  try {
    await assertPermission("returns.manage")
    const result = await getPrisma().$transaction(async (tx) => {
      const existing = await tx.returnRequest.findUnique({
        where: { id },
        select: { status: true, adminNotes: true, timeline: true },
      })
      if (!existing) throw new RequestNotFoundError("That return request no longer exists.")

      const statusChanged = existing.status !== status
      const timeline: RequestTimelineEntry[] = parseTimeline(existing.timeline)
      if (statusChanged) {
        const noteEdited = adminNotes && adminNotes !== existing.adminNotes
        let note = noteEdited ? adminNotes : RETURN_STATUS_NOTES[status]
        if (status === "rejected" && !noteEdited) note = `${note} Reason: ${rejectionReason}`
        timeline.push({ status, label: RETURN_STATUS_LABELS[status], date: new Date().toISOString(), note })
      }

      await tx.returnRequest.update({
        where: { id },
        data: {
          status,
          adminNotes,
          adminInternalNotes,
          rejectionReason: status === "rejected" ? rejectionReason : "",
          ...(statusChanged ? { timeline: timeline as unknown as Prisma.InputJsonValue } : {}),
        },
        select: { id: true },
      })
      return { statusChanged }
    })
    revalidateReturnPaths()
    return { success: true as const, statusChanged: result.statusChanged }
  } catch (error) {
    return { success: false as const, message: mutationError(error) }
  }
}

/**
 * Cancellation requests are created already cancelled by the storefront, so
 * this only records status and notes; it does not cancel or restore the order.
 */
export async function updateCancellationRequestAction(input: unknown) {
  const parsed = cancellationUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false as const, message: parsed.error.issues[0]?.message ?? "Check the cancellation details." }
  }
  const { id, status, adminNotes, adminInternalNotes } = parsed.data

  try {
    await assertPermission("returns.manage")
    const result = await getPrisma().$transaction(async (tx) => {
      const existing = await tx.orderCancellation.findUnique({
        where: { id },
        select: { status: true, adminNotes: true, timeline: true },
      })
      if (!existing) throw new RequestNotFoundError("That cancellation request no longer exists.")

      const statusChanged = existing.status !== status
      const timeline: RequestTimelineEntry[] = parseTimeline(existing.timeline)
      if (statusChanged) {
        const noteEdited = adminNotes && adminNotes !== existing.adminNotes
        timeline.push({
          status,
          label: CANCELLATION_STATUS_LABELS[status],
          date: new Date().toISOString(),
          note: noteEdited ? adminNotes : CANCELLATION_STATUS_NOTES[status],
        })
      }

      await tx.orderCancellation.update({
        where: { id },
        data: {
          status,
          adminNotes,
          adminInternalNotes,
          ...(statusChanged ? { timeline: timeline as unknown as Prisma.InputJsonValue } : {}),
        },
        select: { id: true },
      })
      return { statusChanged }
    })
    revalidateReturnPaths()
    return { success: true as const, statusChanged: result.statusChanged }
  } catch (error) {
    return { success: false as const, message: mutationError(error) }
  }
}
