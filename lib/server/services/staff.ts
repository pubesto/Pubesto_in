import "server-only"

import { randomBytes } from "node:crypto"

import { getAuth } from "@/lib/auth"
import { normalizePermissions } from "@/lib/permissions"
import { assertSuperAdmin } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"
import { getSiteUrl } from "@/lib/server/env"
import type { StaffCreateInput, StaffUpdateInput } from "@/lib/validations/staff"

export class StaffError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "StaffError"
  }
}

function temporaryPassword() {
  return `Pubesto-${randomBytes(12).toString("base64url")}`
}

/**
 * Adds a staff member. An existing customer account is promoted in place; a
 * new account is created through Better Auth so password hashing and session
 * handling stay consistent. Without a temporary password the new member gets
 * a "set your password" email (when email is configured).
 */
export async function createStaffMember(input: StaffCreateInput) {
  await assertSuperAdmin()
  const prisma = getPrisma()

  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, role: true },
  })

  let userId: string
  let created = false
  let invited = false

  if (existing) {
    if (existing.role === "ADMIN") {
      throw new StaffError("That account is already a full administrator.")
    }
    userId = existing.id
  } else {
    const password = input.password ?? temporaryPassword()
    try {
      await getAuth().api.signUpEmail({
        body: { name: input.name, email: input.email, password },
      })
    } catch (error) {
      console.error("[staff] sign-up failed", error)
      throw new StaffError("The account could not be created. Check the email address and try again.")
    }

    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    })
    if (!user) {
      throw new StaffError("The account was not created. Try again.")
    }
    userId = user.id
    created = true

    if (!input.password) {
      try {
        await getAuth().api.requestPasswordReset({
          body: { email: input.email, redirectTo: `${getSiteUrl()}/login` },
        })
        invited = true
      } catch (error) {
        console.error("[staff] could not send set-password email", error)
      }
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: existing ? undefined : input.name,
      role: input.role,
      permissions: input.role === "ADMIN" ? [] : normalizePermissions(input.permissions),
      ...(created ? { emailVerified: true } : {}),
    },
  })

  return { userId, created, invited }
}

export async function updateStaffMember(input: StaffUpdateInput) {
  const admin = await assertSuperAdmin()
  const prisma = getPrisma()

  const target = await prisma.user.findFirst({
    where: { id: input.userId, role: { in: ["ADMIN", "SUB_ADMIN"] } },
    select: { id: true, role: true },
  })
  if (!target) {
    throw new StaffError("That staff member no longer exists.")
  }
  if (target.id === admin.id && input.role !== "ADMIN") {
    throw new StaffError("You cannot remove your own administrator access.")
  }

  await prisma.user.update({
    where: { id: target.id },
    data: {
      role: input.role,
      permissions: input.role === "ADMIN" ? [] : normalizePermissions(input.permissions),
    },
  })

  return { userId: target.id }
}

/**
 * Demotes a staff member back to a customer account and ends their sessions.
 */
export async function removeStaffMember(userId: string) {
  const admin = await assertSuperAdmin()
  const prisma = getPrisma()

  if (userId === admin.id) {
    throw new StaffError("You cannot remove yourself.")
  }

  const target = await prisma.user.findFirst({
    where: { id: userId, role: { in: ["ADMIN", "SUB_ADMIN"] } },
    select: { id: true, role: true },
  })
  if (!target) {
    throw new StaffError("That staff member no longer exists.")
  }

  if (target.role === "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN" } })
    if (admins <= 1) {
      throw new StaffError("At least one full administrator must remain.")
    }
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: target.id },
      data: { role: "CUSTOMER", permissions: [] },
    }),
    prisma.session.deleteMany({ where: { userId: target.id } }),
  ])

  return { userId: target.id }
}
