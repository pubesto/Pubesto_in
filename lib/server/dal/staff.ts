import "server-only"

import { normalizePermissions, type PermissionKey } from "@/lib/permissions"
import { requireSuperAdmin } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"

export type StaffMember = {
  id: string
  name: string
  email: string
  role: "ADMIN" | "SUB_ADMIN"
  permissions: PermissionKey[]
  createdAt: string
  lastActiveAt: string | null
  isCurrentUser: boolean
}

export async function listStaffForAdmin(): Promise<StaffMember[]> {
  const admin = await requireSuperAdmin()
  const users = await getPrisma().user.findMany({
    where: { role: { in: ["ADMIN", "SUB_ADMIN"] } },
    orderBy: [{ role: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      permissions: true,
      createdAt: true,
      sessions: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { updatedAt: true },
      },
    },
  })

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as "ADMIN" | "SUB_ADMIN",
    permissions: normalizePermissions(user.permissions),
    createdAt: user.createdAt.toISOString(),
    lastActiveAt: user.sessions[0]?.updatedAt.toISOString() ?? null,
    isCurrentUser: user.id === admin.id,
  }))
}
