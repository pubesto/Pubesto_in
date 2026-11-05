import "server-only"

import { requirePermission } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"
import { mediaUrl } from "@/lib/server/media"

export type RequestTimelineEntry = {
  status: string
  label: string
  date: string
  note: string
}

export type AdminReturnRequest = {
  id: string
  orderRef: string
  orderId: string | null
  customerEmail: string
  customerName: string
  customerPhone: string
  productName: string
  reason: string
  reasonText: string
  images: string[]
  status: string
  adminNotes: string
  adminInternalNotes: string
  rejectionReason: string
  timeline: RequestTimelineEntry[]
  createdAt: string
  updatedAt: string
}

export type AdminCancellationRequest = {
  id: string
  orderRef: string
  orderId: string | null
  customerEmail: string
  customerName: string
  customerPhone: string
  reason: string
  reasonText: string
  paymentMethod: string
  status: string
  adminNotes: string
  adminInternalNotes: string
  timeline: RequestTimelineEntry[]
  createdAt: string
  updatedAt: string
}

export function parseTimeline(value: unknown): RequestTimelineEntry[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return []
    const record = entry as Record<string, unknown>
    return [
      {
        status: String(record.status ?? ""),
        label: String(record.label ?? record.status ?? ""),
        date: String(record.date ?? ""),
        note: String(record.note ?? ""),
      },
    ]
  })
}

export async function listReturnRequestsForAdmin(): Promise<AdminReturnRequest[]> {
  await requirePermission("returns.view")
  const rows = await getPrisma().returnRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 1000,
  })
  return rows.map((row) => ({
    id: row.id,
    orderRef: row.orderRef,
    orderId: row.orderId,
    customerEmail: row.customerEmail,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    productName: row.productName,
    reason: row.reason,
    reasonText: row.reasonText,
    images: row.images.map((key) => mediaUrl(key) ?? key),
    status: row.status,
    adminNotes: row.adminNotes,
    adminInternalNotes: row.adminInternalNotes,
    rejectionReason: row.rejectionReason,
    timeline: parseTimeline(row.timeline),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }))
}

export async function listCancellationRequestsForAdmin(): Promise<AdminCancellationRequest[]> {
  await requirePermission("returns.view")
  const rows = await getPrisma().orderCancellation.findMany({
    orderBy: { createdAt: "desc" },
    take: 1000,
  })
  return rows.map((row) => ({
    id: row.id,
    orderRef: row.orderRef,
    orderId: row.orderId,
    customerEmail: row.customerEmail,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    reason: row.reason,
    reasonText: row.reasonText,
    paymentMethod: row.paymentMethod,
    status: row.status,
    adminNotes: row.adminNotes,
    adminInternalNotes: row.adminInternalNotes,
    timeline: parseTimeline(row.timeline),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }))
}
