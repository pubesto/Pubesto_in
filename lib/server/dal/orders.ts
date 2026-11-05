import "server-only"

import { requirePermission } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"
import { calculateGst, getTaxSettings, type TaxSettingData } from "@/lib/server/dal/taxes"
import { formatOrderReference } from "@/lib/checkout-rules"

type OrderStatus = "PENDING" | "CONFIRMED" | "FULFILLED" | "CANCELLED"

function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

export type AdminOrderListItem = {
  id: string
  number: number
  createdAt: string
  customer: { id: string; name: string } | null
  email: string
  status: OrderStatus
  currency: string
  total: number
  itemCount: number
  /** Customer-facing reference: PUB-00012, or the old Shopify number (#1001). */
  reference: string
  paymentStatus: string
  paymentMethod: string | null
}

export type AdminOrderMetrics = {
  orderCount: number
  itemCount: number
  returnsAmount: number
  fulfilledCount: number
  deliveredCount: number
}

export type AdminOrderDashboard = {
  orders: AdminOrderListItem[]
  metrics: AdminOrderMetrics
}

export type AdminOrderDetail = AdminOrderListItem & {
  subtotal: number
  discount: number
  shipping: number
  tax: number
  cgst: number
  sgst: number
  igst: number
  taxableAmount: number
  isIntraState: boolean
  destinationState: string
  originState: string
  gstin: string
  taxSettings: TaxSettingData
  shippingAddress: {
    name?: string
    address1?: string
    address2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
    phone?: string
  } | null
  items: Array<{
    id: string
    title: string
    sku: string
    quantity: number
    unitPrice: number
    total: number
    variantId: string | null
    taxRate: number
    tax: number
    hsnCode: string
    taxableAmount: number
    cgst: number
    sgst: number
    igst: number
  }>
  phone: string | null
  courier: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  cancelReason: string | null
  customerNote: string | null
  discountCode: string | null
  source: string
  paymentDetails: {
    razorpayOrderId?: string
    razorpayPaymentId?: string
    razorpaySignature?: string
    paidAt?: string
  } | null
}

export type AdminOrderCreateOption = {
  id: string
  productTitle: string
  title: string
  sku: string
  price: number
  inventoryQuantity: number
}

export type AdminOrderCustomerOption = {
  id: string
  name: string
  email: string
}

function mapOrder(order: {
  id: string
  number: number
  createdAt: Date
  email: string
  status: OrderStatus
  currency: string
  total: { toString(): string }
  user: { id: string; name: string } | null
  items: Array<{ quantity: number }>
  legacyName: string | null
  paymentStatus: string
  paymentMethod: string | null
}): AdminOrderListItem {
  return {
    id: order.id,
    number: order.number,
    createdAt: order.createdAt.toISOString(),
    customer: order.user,
    email: order.email,
    status: order.status,
    currency: order.currency,
    total: Number(order.total),
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    reference: order.legacyName ?? formatOrderReference(order.number),
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
  }
}

export async function listOrdersForAdmin(): Promise<AdminOrderDashboard> {
  await requirePermission("orders.view")
  const prisma = getPrisma()
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      createdAt: true,
      email: true,
      status: true,
      currency: true,
      total: true,
      user: { select: { id: true, name: true } },
      items: { select: { quantity: true } },
      legacyName: true,
      paymentStatus: true,
      paymentMethod: true,
    },
  })
  const mappedOrders = orders.map(mapOrder)
  const today = startOfToday()
  const todayOrders = mappedOrders.filter(
    (order) => new Date(order.createdAt) >= today,
  )

  return {
    orders: mappedOrders,
    metrics: {
      orderCount: todayOrders.length,
      itemCount: todayOrders.reduce((sum, order) => sum + order.itemCount, 0),
      returnsAmount: 0,
      fulfilledCount: todayOrders.filter((order) => order.status === "FULFILLED").length,
      deliveredCount: todayOrders.filter((order) => order.status === "FULFILLED").length,
    },
  }
}

export async function getOrderForAdmin(
  orderId: string,
): Promise<AdminOrderDetail | null> {
  await requirePermission("orders.view")
  const prisma = getPrisma()
  const [order, taxSettings] = await Promise.all([
    prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, name: true } },
        items: {
          include: {
            variant: {
              include: {
                product: {
                  select: {
                    id: true,
                    title: true,
                    taxRate: true,
                    hsnCode: true,
                    isTaxExempt: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    getTaxSettings(),
  ])

  if (!order) return null

  const shippingAddr = (order.shippingAddress as Record<string, unknown> | null) ?? {}
  const destinationState =
    typeof shippingAddr.state === "string" && shippingAddr.state.trim().length > 0
      ? shippingAddr.state.trim()
      : taxSettings.originState
  const isIntraState =
    destinationState.toLowerCase() === taxSettings.originState.toLowerCase()

  const mappedItems = order.items.map((item) => {
    const product = item.variant?.product
    const itemRate = product?.isTaxExempt
      ? 0
      : item.taxRate !== null && item.taxRate !== undefined
      ? Number(item.taxRate)
      : product?.taxRate !== null && product?.taxRate !== undefined
      ? Number(product.taxRate)
      : taxSettings.defaultGstRate
    const hsnCode = item.hsnCode || product?.hsnCode || taxSettings.defaultHsn
    const itemTotal = Number(item.total)

    const itemCalc = calculateGst(
      itemTotal,
      itemRate,
      taxSettings.priceInclusive,
      taxSettings.originState,
      destinationState,
    )

    return {
      id: item.id,
      title: item.title,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      total: itemTotal,
      variantId: item.variantId,
      taxRate: itemRate,
      tax: itemCalc.totalGst,
      hsnCode,
      taxableAmount: itemCalc.taxableAmount,
      cgst: itemCalc.cgst,
      sgst: itemCalc.sgst,
      igst: itemCalc.igst,
    }
  })

  const calcTaxable = mappedItems.reduce((sum, i) => sum + i.taxableAmount, 0)
  const calcTax = mappedItems.reduce((sum, i) => sum + i.tax, 0)
  const calcCgst = mappedItems.reduce((sum, i) => sum + i.cgst, 0)
  const calcSgst = mappedItems.reduce((sum, i) => sum + i.sgst, 0)
  const calcIgst = mappedItems.reduce((sum, i) => sum + i.igst, 0)

  const tax = Number(order.tax) > 0 ? Number(order.tax) : Number(calcTax.toFixed(2))
  const cgst = Number(order.cgst) > 0 ? Number(order.cgst) : Number(calcCgst.toFixed(2))
  const sgst = Number(order.sgst) > 0 ? Number(order.sgst) : Number(calcSgst.toFixed(2))
  const igst = Number(order.igst) > 0 ? Number(order.igst) : Number(calcIgst.toFixed(2))

  return {
    ...mapOrder(order),
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    shipping: Number(order.shipping),
    tax,
    cgst,
    sgst,
    igst,
    taxableAmount: Number(calcTaxable.toFixed(2)),
    isIntraState,
    destinationState,
    originState: taxSettings.originState,
    gstin: taxSettings.gstin,
    taxSettings,
    shippingAddress: (order.shippingAddress as any) ?? null,
    paymentMethod: order.paymentMethod,
    phone: order.phone,
    courier: order.courier,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    cancelReason: order.cancelReason,
    customerNote: order.customerNote,
    discountCode: order.discountCode,
    source: order.source,
    paymentDetails: (order.taxDetails as any)?.payment ?? null,
    items: mappedItems,
  }
}

export async function listOrderCreationOptionsForAdmin(): Promise<{
  variants: AdminOrderCreateOption[]
  customers: AdminOrderCustomerOption[]
}> {
  await requirePermission("orders.view")
  const prisma = getPrisma()
  const [variants, customers] = await Promise.all([
    prisma.productVariant.findMany({
      where: { product: { status: { not: "ARCHIVED" } } },
      orderBy: [{ product: { title: "asc" } }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        sku: true,
        price: true,
        inventoryQuantity: true,
        product: { select: { title: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "CUSTOMER" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ])

  return {
    variants: variants.map((variant) => ({
      id: variant.id,
      productTitle: variant.product.title,
      title: variant.title,
      sku: variant.sku,
      price: Number(variant.price),
      inventoryQuantity: variant.inventoryQuantity,
    })),
    customers,
  }
}
