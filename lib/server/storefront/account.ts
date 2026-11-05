import "server-only"

import { formatOrderReference } from "@/lib/checkout-rules"
import { getCurrentUser } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"
import { mediaUrl } from "@/lib/server/media"

export type StorefrontAddress = {
  id: string
  label: string
  name: string
  phone: string
  line1: string
  line2: string
  city: string
  state: string
  pincode: string
  isDefault?: boolean
}

export type StorefrontUser = {
  id: string
  name: string
  firstName: string
  lastName: string
  email: string
  phone: string
  image: string | null
  role: string
  provider: string
  addresses: StorefrontAddress[]
}

function cleanAddress(raw: unknown, index: number): StorefrontAddress | null {
  if (!raw || typeof raw !== "object") return null
  const value = raw as Record<string, unknown>
  const text = (key: string) => String(value[key] ?? "").trim()
  const line1 = text("line1")
  if (!line1 && !text("city")) return null
  return {
    id: text("id") || `addr_${index}`,
    label: text("label") || "Home",
    name: text("name"),
    phone: text("phone"),
    line1,
    line2: text("line2"),
    city: text("city"),
    state: text("state"),
    pincode: text("pincode"),
    isDefault: Boolean(value.isDefault),
  }
}

export function normalizeAddresses(raw: unknown): StorefrontAddress[] {
  return (Array.isArray(raw) ? raw : [])
    .map(cleanAddress)
    .filter((address): address is StorefrontAddress => Boolean(address))
    .slice(0, 10)
}

/** The signed-in shopper in the shape the storefront pages expect, or null. */
export async function getStorefrontUser(): Promise<StorefrontUser | null> {
  const user = await getCurrentUser()
  if (!user) return null
  const profile = await getPrisma().user.findUnique({
    where: { id: user.id },
    select: { addresses: true, accounts: { select: { providerId: true } } },
  })
  const parts = user.name.trim().split(/\s+/)
  return {
    id: user.id,
    name: user.name,
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
    email: user.email,
    phone: user.phone ?? "",
    image: user.image,
    role: user.role,
    provider: profile?.accounts.some((account) => account.providerId === "google") ? "google" : "email",
    addresses: normalizeAddresses(profile?.addresses),
  }
}

/** Customer-facing order reference: the old Shopify number for imported orders. */
export function orderReference(order: { number: number; legacyName: string | null }) {
  return order.legacyName ?? formatOrderReference(order.number)
}

/** Finds an order from what a customer types: "PUB-00012", "12", "#1006" or "1006". */
export async function findOrderByReference(reference: string) {
  const prisma = getPrisma()
  const raw = String(reference || "").trim().toUpperCase()
  if (!raw) return null
  const digits = raw.replace(/\D/g, "")
  const candidates: Array<Record<string, unknown>> = []
  if (raw.startsWith("PUB-") && digits) candidates.push({ number: Number(digits) })
  if (digits) candidates.push({ legacyName: `#${digits}` })
  if (!raw.startsWith("PUB-") && digits && digits.length <= 6) candidates.push({ number: Number(digits) })
  for (const where of candidates) {
    const order = await prisma.order.findFirst({ where, include: { items: true } })
    if (order) return order
  }
  return null
}

/** Account-page status: processing → shipped → delivered, or cancelled. */
export function storefrontOrderStatus(order: {
  status: string
  trackingNumber: string | null
}) {
  if (order.status === "CANCELLED") return "cancelled"
  if (order.status === "FULFILLED") return "delivered"
  if (order.trackingNumber) return "shipped"
  return "processing"
}

export async function listCustomerOrders(user: { id: string; email: string }) {
  const prisma = getPrisma()
  const orders = await prisma.order.findMany({
    where: {
      OR: [{ userId: user.id }, { email: { equals: user.email, mode: "insensitive" } }],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      items: {
        include: {
          variant: {
            select: {
              optionValues: true,
              product: {
                select: {
                  slug: true,
                  title: true,
                  images: { orderBy: { position: "asc" }, take: 1, select: { objectKey: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  return orders.map((order) => ({
    id: orderReference(order),
    orderId: order.id,
    date: order.createdAt.toISOString(),
    items: order.items.map((item) => {
      const product = item.variant?.product
      const options = (item.variant?.optionValues ?? {}) as Record<string, string>
      const priceNumber = Number(item.unitPrice)
      return {
        id: item.variantId ?? item.id,
        name: product?.title ?? item.title,
        image: mediaUrl(product?.images[0]?.objectKey) ?? "/favicon.png",
        price: `Rs. ${priceNumber.toLocaleString("en-IN")}`,
        priceNumber,
        quantity: item.quantity,
        slug: product?.slug ?? "",
        color: options.Color ?? null,
      }
    }),
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    shipping: Number(order.shipping),
    total: Number(order.total),
    status: storefrontOrderStatus(order),
    paymentStatus: order.paymentStatus === "PAID" ? "paid" : order.paymentStatus === "REFUNDED" ? "refunded" : "pending",
    paymentMethod: order.paymentMethod === "COD" ? "cod" : "prepaid",
    paymentId: order.razorpayPaymentId ?? order.id,
    courier: order.courier,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    shippingAddress: order.shippingAddress,
  }))
}
