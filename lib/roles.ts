export type AppRole = "CUSTOMER" | "SUB_ADMIN" | "ADMIN"

export const STAFF_ROLES: readonly AppRole[] = ["ADMIN", "SUB_ADMIN"] as const

/** Anyone allowed into the dashboard. */
export function isStaffRole(
  role: string | null | undefined,
): role is "ADMIN" | "SUB_ADMIN" {
  return role === "ADMIN" || role === "SUB_ADMIN"
}

/** Full administrators only: destructive actions, store settings, staff management. */
export function isSuperAdminRole(role: string | null | undefined): role is "ADMIN" {
  return role === "ADMIN"
}
