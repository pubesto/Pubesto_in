import "server-only"

import { getPrisma } from "@/lib/server/db"
import type { TrackOrderLookup } from "@/lib/validations/contact"

export type TrackedOrder = {
  reference: string
  status: "PENDING" | "CONFIRMED" | "FULFILLED" | "CANCELLED"
  statusLabel: string
  statusDetail: string
  placedAt: string
  total: number
  currency: string
  itemCount: number
  items: Array<{ title: string; quantity: number }>
  shippingMethod: string | null
  city: string | null
}

const STATUS_COPY: Record<TrackedOrder["status"], { label: string; detail: string }> = {
  PENDING: {
    label: "Order received",
    detail: "We have your order and are confirming payment.",
  },
  CONFIRMED: {
    label: "Being prepared",
    detail: "Payment confirmed. Your pieces are being packed in our studio.",
  },
  FULFILLED: {
    label: "Shipped",
    detail: "Your order is on its way. Delivery usually takes 2 to 4 business days.",
  },
  CANCELLED: {
    label: "Cancelled",
    detail: "This order was cancelled. Any payment will be refunded to the original method.",
  },
}

/**
 * Public, unauthenticated lookup. The email (and optional PIN code) act as
 * the shared secret, so nothing is returned unless both match.
 */
export async function findOrderForTracking(lookup: TrackOrderLookup): Promise<TrackedOrder | null> {
  const number = Number.parseInt(lookup.order, 10)
  if (!Number.isFinite(number) || number <= 0) return null

  const order = await getPrisma().order.findFirst({
    where: { number, email: lookup.email },
    select: {
      number: true,
      status: true,
      total: true,
      currency: true,
      createdAt: true,
      shippingMethod: true,
      shippingAddress: true,
      items: { select: { title: true, quantity: true } },
    },
  })

  if (!order) return null

  const address =
    order.shippingAddress && typeof order.shippingAddress === "object" && !Array.isArray(order.shippingAddress)
      ? (order.shippingAddress as Record<string, unknown>)
      : null
  const postalCode = typeof address?.postalCode === "string" ? address.postalCode : null

  if (lookup.postcode && postalCode && lookup.postcode.replace(/\s/g, "") !== postalCode.replace(/\s/g, "")) {
    return null
  }

  const copy = STATUS_COPY[order.status]

  return {
    reference: `PUB-${String(order.number).padStart(5, "0")}`,
    status: order.status,
    statusLabel: copy.label,
    statusDetail: copy.detail,
    placedAt: order.createdAt.toISOString(),
    total: Number(order.total),
    currency: order.currency,
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    items: order.items,
    shippingMethod: order.shippingMethod,
    city: typeof address?.city === "string" ? address.city : null,
  }
}
