"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { normalizePermissions, type PermissionKey } from "@/lib/permissions"
import { getCurrentUser, permissionErrorMessage } from "@/lib/server/dal/auth"
import {
  createStaffMember,
  removeStaffMember,
  StaffError,
  updateStaffMember,
} from "@/lib/server/services/staff"
import { staffCreateSchema, staffIdSchema, staffUpdateSchema } from "@/lib/validations/staff"

export type StaffAccess = {
  role: "ADMIN" | "SUB_ADMIN" | "CUSTOMER" | null
  permissions: PermissionKey[]
}

/** Used by the dashboard sidebar to hide modules the viewer cannot open. */
export async function getStaffAccessAction(): Promise<StaffAccess> {
  try {
    const user = await getCurrentUser()
    if (!user) return { role: null, permissions: [] }
    return {
      role: user.role,
      permissions: normalizePermissions(user.permissions),
    }
  } catch {
    return { role: null, permissions: [] }
  }
}

function mutationError(error: unknown) {
  const denied = permissionErrorMessage(error)
  if (denied) return denied
  if (error instanceof StaffError) return error.message
  return "The staff member could not be updated. Try again."
}

function firstIssue(error: z.ZodError) {
  const flat = z.flattenError(error)
  return flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat().find(Boolean)
}

export async function createStaffAction(input: unknown) {
  const result = staffCreateSchema.safeParse(input)
  if (!result.success) {
    return { success: false as const, message: firstIssue(result.error) ?? "Check the staff details." }
  }

  try {
    const outcome = await createStaffMember(result.data)
    revalidatePath("/dashboard/settings/staff")
    return {
      success: true as const,
      userId: outcome.userId,
      created: outcome.created,
      invited: outcome.invited,
    }
  } catch (error) {
    return { success: false as const, message: mutationError(error) }
  }
}

export async function updateStaffAction(input: unknown) {
  const result = staffUpdateSchema.safeParse(input)
  if (!result.success) {
    return { success: false as const, message: firstIssue(result.error) ?? "Check the staff details." }
  }

  try {
    await updateStaffMember(result.data)
    revalidatePath("/dashboard/settings/staff")
    return { success: true as const }
  } catch (error) {
    return { success: false as const, message: mutationError(error) }
  }
}

export async function removeStaffAction(input: unknown) {
  const result = staffIdSchema.safeParse(input)
  if (!result.success) {
    return { success: false as const, message: "Select a staff member." }
  }

  try {
    await removeStaffMember(result.data.userId)
    revalidatePath("/dashboard/settings/staff")
    return { success: true as const }
  } catch (error) {
    return { success: false as const, message: mutationError(error) }
  }
}
