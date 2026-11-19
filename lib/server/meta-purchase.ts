import "server-only"

import { cookies, headers } from "next/headers"

import { getPrisma } from "@/lib/server/db"
import { sendMetaEvent } from "@/lib/meta-capi"

/**
 * Server-side Meta "Purchase" for paid (Razorpay) orders, via the Conversions API.
 *
 * The browser also sends Purchase from the thank-you screen, but shoppers who pay in a
 * UPI app and never come back to the tab would otherwise be lost. Both copies use the
 * event_id `Purchase-<order.id>`, so Meta counts each order once.
 */

/** Browser details that help Meta match the purchase to the ad click. */
export type MetaBrowserContext = {
  ip?: string
  userAgent?: string
  fbp?: string
  fbc?: string
  sourceUrl?: string
}

/** Reads the shopper's Meta cookies and request info. Call inside a server action / route. */
export async function captureMetaContext(): Promise<MetaBrowserContext> {
  try {
    const cookieStore = await cookies()
    const headerStore = await headers()
    const forwarded = headerStore.get("x-forwarded-for")
    return {
      ip: forwarded ? forwarded.split(",")[0]!.trim() : headerStore.get("x-real-ip") || undefined,
      userAgent: headerStore.get("user-agent") || undefined,
      fbp: cookieStore.get("_fbp")?.value,
      fbc: cookieStore.get("_fbc")?.value,
      sourceUrl: headerStore.get("referer") || undefined,
    }
  } catch {
    return {}
  }
}

/** The context saved with a pending checkout (see createRazorpayOrderAction). */
export function readSavedMetaContext(payload: unknown): MetaBrowserContext {
  const saved = (payload as { _meta?: unknown } | null)?._meta
  if (!saved || typeof saved !== "object") return {}
  const pick = (key: keyof MetaBrowserContext) => {
    const value = (saved as Record<string, unknown>)[key]
    return typeof value === "string" && value ? value.slice(0, 1000) : undefined
  }
  return {
    ip: pick("ip"),
    userAgent: pick("userAgent"),
    fbp: pick("fbp"),
    fbc: pick("fbc"),
    sourceUrl: pick("sourceUrl"),
  }
}

function indianPhone(phone: string | null | undefined) {
  const digits = String(phone || "").replace(/\D/g, "")
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith("91")) return digits
  return digits || undefined
}

/** Sends Purchase for a paid order. Never throws: tracking must not break checkout. */
export async function sendPurchaseEvent(orderId: string, context: MetaBrowserContext = {}) {
  try {
    const order = await getPrisma().order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        email: true,
        phone: true,
        total: true,
        currency: true,
        paymentStatus: true,
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            sku: true,
            title: true,
            variant: { select: { product: { select: { slug: true } } } },
          },
        },
      },
    })
    if (!order || order.paymentStatus !== "PAID" || !order.items.length) return

    // Same content ids as the browser pixel (product slug).
    const contents = order.items.map((item) => ({
      id: item.variant?.product?.slug || item.sku || item.title,
      quantity: item.quantity,
      item_price: Number(item.unitPrice),
    }))

    await sendMetaEvent({
      eventName: "Purchase",
      eventId: `Purchase-${order.id}`,
      eventSourceUrl: context.sourceUrl,
      customData: {
        content_ids: contents.map((c) => c.id),
        content_type: "product",
        contents,
        num_items: contents.reduce((sum, c) => sum + c.quantity, 0),
        value: Math.round(Number(order.total) * 100) / 100,
        currency: order.currency || "INR",
        order_id: order.id,
      },
      user: {
        ip: context.ip,
        userAgent: context.userAgent,
        fbp: context.fbp,
        fbc: context.fbc,
        email: order.email,
        phone: indianPhone(order.phone),
        country: "in", // all orders ship within India
        id: order.userId ?? undefined,
      },
    })
  } catch (error) {
    console.error("[meta] Purchase event failed", orderId, error instanceof Error ? error.message : error)
  }
}
