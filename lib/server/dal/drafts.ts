import "server-only"

import { requirePermission } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"

export type AdminDraftListItem = {
  id: string
  number: number
  email: string
  customer: { id: string; name: string } | null
  status: "DRAFT" | "SENT" | "COMPLETED"
  total: number
  currency: string
  itemCount: number
  createdAt: string
}

export async function listDraftsForAdmin(): Promise<AdminDraftListItem[]> {
  await requirePermission("orders.view")
  const drafts = await getPrisma().draftOrder.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      email: true,
      status: true,
      total: true,
      currency: true,
      createdAt: true,
      user: { select: { id: true, name: true } },
      items: { select: { quantity: true } },
    },
  })

  return drafts.map((draft) => ({
    id: draft.id,
    number: draft.number,
    email: draft.email,
    customer: draft.user,
    status: draft.status,
    total: Number(draft.total),
    currency: draft.currency,
    itemCount: draft.items.reduce((sum, item) => sum + item.quantity, 0),
    createdAt: draft.createdAt.toISOString(),
  }))
}
