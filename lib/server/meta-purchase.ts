import "server-only"

import { cookies, headers } from "next/headers"

import { formatOrderReference } from "@/lib/checkout-rules"
import { getPrisma } from "@/lib/server/db"
import { isMetaCapiConfigured, sendMetaEvent } from "@/lib/meta-capi"

/**
 * Server-side Meta "Purchase" via the Conversions API, sent once per confirmed order:
 *  - Razorpay: after the payment signature is verified (checkout action) or the webhook
 *    marks the order paid.
 *  - Cash on delivery: right after the order is created.
 *
 * The browser sends the same event from the thank-you screen (lib/meta-pixel.js
 * trackPurchase). Both use event_id `purchase_<order reference>`, e.g. `purchase_PUB-00013`,
 * so Meta keeps one. `orders.metaPurchaseSentAt` stops webhook retries sending it twice.
 */

/** Same id the browser pixel uses. Keep in sync with purchaseEventId in lib/meta-pixel.js. */
export function purchaseEventId(orderNumber: number) {
  return `purchase_${formatOrderReference(orderNumber)}`
}

/** Browser details that help Meta match the purchase to the ad click. */
export type MetaBrowserContext = {
  ip?: string
  userAgent?: string
  fbp?: string
  fbc?: string
  sourceUrl?: string
}

// _fbc is set by the pixel after an ad click; build it from fbclid if the pixel was blocked.
function clickIdFromUrl(url: string | null | undefined) {
  if (!url) return undefined
  try {
    const fbclid = new URL(url).searchParams.get("fbclid")
    return fbclid ? `fb.1.${Date.now()}.${fbclid}` : undefined
  } catch {
    return undefined
  }
}

/** Reads the shopper's Meta cookies and request info. Call inside a server action / route. */
export async function captureMetaContext(): Promise<MetaBrowserContext> {
  try {
    const cookieStore = await cookies()
    const headerStore = await headers()
    const forwarded = headerStore.get("x-forwarded-for")
    const referer = headerStore.get("referer") || undefined
    return {
      ip: forwarded ? forwarded.split(",")[0]!.trim() : headerStore.get("x-real-ip") || undefined,
      userAgent: headerStore.get("user-agent") || undefined,
      fbp: cookieStore.get("_fbp")?.value,
      fbc: cookieStore.get("_fbc")?.value || clickIdFromUrl(referer),
      sourceUrl: referer,
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

/** Merges two contexts, keeping `primary` values and filling gaps from `fallback`. */
export function mergeMetaContext(primary: MetaBrowserContext, fallback: MetaBrowserContext): MetaBrowserContext {
  const merged: MetaBrowserContext = { ...fallback }
  for (const [key, value] of Object.entries(primary) as [keyof MetaBrowserContext, string | undefined][]) {
    if (value) merged[key] = value
  }
  return merged
}

function indianPhone(phone: string | null | undefined) {
  const digits = String(phone || "").replace(/\D/g, "")
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith("91")) return digits
  return digits || undefined
}

function readAddress(value: unknown) {
  const address = (value && typeof value === "object" ? value : {}) as Record<string, unknown>
  const text = (key: string) => (typeof address[key] === "string" ? (address[key] as string).trim() : "")
  const [firstName, ...rest] = text("name").split(/\s+/)
  return {
    firstName: firstName || undefined,
    lastName: rest.join(" ") || undefined,
    city: text("city") || undefined,
    state: text("state") || undefined,
    zip: text("postalCode") || undefined,
  }
}

/** A paid online order, or a cash-on-delivery order that hasn't been cancelled. */
function isConfirmedOrder(order: { paymentStatus: string; paymentMethod: string | null; status: string }) {
  if (order.paymentStatus === "PAID") return true
  return order.paymentMethod === "COD" && order.status !== "CANCELLED"
}

/** Sends Purchase for a confirmed order, at most once. Never throws: tracking must not break checkout. */
export async function sendPurchaseEvent(orderId: string, context: MetaBrowserContext = {}) {
  if (!isMetaCapiConfigured()) {
    console.warn("[meta] Purchase not sent: Conversions API is not configured", orderId)
    return
  }
  const prisma = getPrisma()
  let claimed = false
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        number: true,
        userId: true,
        email: true,
        phone: true,
        total: true,
        currency: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        shippingAddress: true,
        metaPurchaseSentAt: true,
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
    if (!order || order.metaPurchaseSentAt || !isConfirmedOrder(order) || !order.items.length) return

    // Claim the order first so a concurrent webhook / confirm call can't send it again.
    const claim = await prisma.order.updateMany({
      where: { id: order.id, metaPurchaseSentAt: null },
      data: { metaPurchaseSentAt: new Date() },
    })
    if (claim.count !== 1) return
    claimed = true

    // Same content ids as ViewContent / InitiateCheckout (product slug).
    const contents = order.items.map((item) => ({
      id: item.variant?.product?.slug || item.sku || item.title,
      quantity: item.quantity,
      item_price: Number(item.unitPrice),
    }))
    const reference = formatOrderReference(order.number)
    const address = readAddress(order.shippingAddress)

    await sendMetaEvent({
      eventName: "Purchase",
      eventId: purchaseEventId(order.number),
      eventSourceUrl: context.sourceUrl || "https://www.pubesto.com/checkout",
      customData: {
        content_ids: contents.map((c) => c.id),
        content_type: "product",
        contents,
        num_items: contents.reduce((sum, c) => sum + c.quantity, 0),
        // Amount the customer actually pays (after the prepaid discount for Razorpay).
        value: Math.round(Number(order.total) * 100) / 100,
        currency: order.currency || "INR",
        order_id: reference,
      },
      user: {
        ip: context.ip,
        userAgent: context.userAgent,
        fbp: context.fbp,
        fbc: context.fbc,
        email: order.email,
        phone: indianPhone(order.phone),
        firstName: address.firstName,
        lastName: address.lastName,
        city: address.city,
        state: address.state,
        zip: address.zip,
        country: "in", // all orders ship within India
        id: order.userId ?? undefined,
      },
    })
  } catch (error) {
    console.error("[meta] Purchase event failed", orderId, error instanceof Error ? error.message : error)
    // Let a later webhook retry send it.
    if (claimed) {
      await prisma.order
        .updateMany({ where: { id: orderId }, data: { metaPurchaseSentAt: null } })
        .catch(() => {})
    }
  }
}
