import "server-only"

import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getAuth } from "@/lib/auth"
import { hasPermission, type PermissionKey } from "@/lib/permissions"
import { isStaffRole, isSuperAdminRole } from "@/lib/roles"
import { getPrisma } from "@/lib/server/db"

export const getCurrentUser = cache(async () => {
  const requestHeaders = await headers()
  const session = await getAuth().api.getSession({
    headers: requestHeaders,
  })

  if (!session?.user.id) {
    return null
  }

  return getPrisma().user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      phone: true,
      permissions: true,
    },
  })
})

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

export async function requireUser() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/account/login")
  }

  return user
}

/**
 * Dashboard access: ADMIN and SUB_ADMIN. Redirects for page rendering.
 */
export async function requireAdmin() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/admin/login")
  }

  if (!isStaffRole(user.role)) {
    redirect("/admin/login?denied=1")
  }

  return user
}

/**
 * Full administrator only. Redirects sub-admins back to the dashboard home.
 */
export async function requireSuperAdmin() {
  const user = await requireAdmin()

  if (!isSuperAdminRole(user.role)) {
    redirect("/dashboard?denied=admin")
  }

  return user
}

/**
 * Page-level permission check. ADMIN always passes; SUB_ADMIN must hold the
 * permission. Redirects to the dashboard home with a `denied` flag.
 */
export async function requirePermission(permission: PermissionKey) {
  const user = await requireAdmin()

  if (!hasPermission(user, permission)) {
    redirect(`/dashboard?denied=${encodeURIComponent(permission)}`)
  }

  return user
}

/**
 * Dashboard access for mutations: ADMIN and SUB_ADMIN. Throws for Server
 * Actions and Route Handlers.
 */
export async function assertAdmin() {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error("Unauthorized")
  }

  if (!isStaffRole(user.role)) {
    throw new Error("Forbidden")
  }

  return user
}

/**
 * Destructive or store-wide mutations: ADMIN only.
 */
export async function assertSuperAdmin() {
  const user = await assertAdmin()

  if (!isSuperAdminRole(user.role)) {
    throw new Error("SuperAdminRequired")
  }

  return user
}

/**
 * Mutation-level permission check. Throws `PermissionDenied:<key>` so the
 * action layer can show which permission is missing.
 */
export async function assertPermission(permission: PermissionKey) {
  const user = await assertAdmin()

  if (!hasPermission(user, permission)) {
    throw new Error(`PermissionDenied:${permission}`)
  }

  return user
}

export function permissionErrorMessage(error: unknown): string | null {
  if (!(error instanceof Error)) return null
  if (error.message === "Unauthorized") return "Sign in to continue."
  if (error.message === "Forbidden") return "Administrator access is required."
  if (error.message === "SuperAdminRequired") return "Only a full administrator can do this."
  if (error.message.startsWith("PermissionDenied:")) {
    const key = error.message.slice("PermissionDenied:".length)
    return `You don't have the "${key}" permission. Ask an administrator to grant it.`
  }
  return null
}
