import "server-only"

import { requirePermission } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"

export type AdminContactMessage = {
  id: string
  name: string
  email: string
  subject: string
  message: string
  status: "NEW" | "READ" | "RESOLVED"
  createdAt: string
  updatedAt: string
}

export async function listContactMessagesForAdmin(): Promise<AdminContactMessage[]> {
  await requirePermission("messages.view")
  const rows = await getPrisma().contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 1000,
  })
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    subject: row.subject,
    message: row.message,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }))
}
