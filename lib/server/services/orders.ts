import "server-only"

import { Prisma } from "@/generated/prisma/client"
import { assertPermission } from "@/lib/server/dal/auth"
import { calculateGst } from "@/lib/server/dal/taxes"
import { getPrisma } from "@/lib/server/db"
import type { OrderCreateInput } from "@/lib/validations/order"

export async function createOrder(input: OrderCreateInput) {
  await assertPermission("orders.manage")
  const prisma = getPrisma()

  return prisma.$transaction(async (tx) => {
    const [customer, variants, taxSetting] = await Promise.all([
      input.customerId
        ? tx.user.findFirst({
            where: { id: input.customerId, role: "CUSTOMER" },
            select: { id: true, email: true },
          })
        : null,
      tx.productVariant.findMany({
        where: { id: { in: input.items.map((item) => item.variantId) } },
        select: {
          id: true,
          title: true,
          sku: true,
          price: true,
          product: {
            select: {
              title: true,
              status: true,
              taxRate: true,
              hsnCode: true,
              isTaxExempt: true,
            },
          },
        },
      }),
      tx.taxSetting.findFirst(),
    ])

    if (input.customerId && !customer) {
      throw new Error("The selected customer no longer exists.")
    }
    if (variants.length !== input.items.length) {
      throw new Error("One or more selected products no longer exist.")
    }
    if (variants.some((variant) => variant.product.status === "ARCHIVED")) {
      throw new Error("Archived products cannot be added to an order.")
    }

    const originState = taxSetting?.originState ?? "Maharashtra"
    const defaultRate = taxSetting?.defaultGstRate ? Number(taxSetting.defaultGstRate) : 12
    const defaultHsn = taxSetting?.defaultHsn ?? ""
    const priceInclusive = taxSetting?.priceInclusive ?? true

    let orderTaxTotal = 0
    let orderCgstTotal = 0
    let orderSgstTotal = 0
    let orderIgstTotal = 0

    const variantsById = new Map(variants.map((variant) => [variant.id, variant]))
    const items = input.items.map((item) => {
      const variant = variantsById.get(item.variantId)!
      const total = variant.price.mul(item.quantity)
      const taxRate = variant.product.isTaxExempt
        ? 0
        : variant.product.taxRate !== null && variant.product.taxRate !== undefined
        ? Number(variant.product.taxRate)
        : defaultRate
      const hsnCode = variant.product.hsnCode || defaultHsn

      // Calculate GST for line item
      const itemTax = calculateGst(
        Number(total),
        taxRate,
        priceInclusive,
        originState,
        originState // intra-state for admin quick orders
      )

      orderTaxTotal += itemTax.totalGst
      orderCgstTotal += itemTax.cgst
      orderSgstTotal += itemTax.sgst
      orderIgstTotal += itemTax.igst

      return {
        variantId: variant.id,
        title:
          variant.title === "Default"
            ? variant.product.title
            : `${variant.product.title} · ${variant.title}`,
        sku: variant.sku,
        quantity: item.quantity,
        unitPrice: variant.price,
        total,
        taxRate: new Prisma.Decimal(taxRate),
        tax: new Prisma.Decimal(itemTax.totalGst),
        hsnCode,
      }
    })
    const subtotal = items.reduce(
      (sum, item) => sum.plus(item.total),
      new Prisma.Decimal(0),
    )

    const order = await tx.order.create({
      data: {
        userId: customer?.id ?? null,
        email: customer?.email ?? input.email!,
        status: input.status,
        currency: "INR",
        subtotal,
        discount: new Prisma.Decimal(0),
        shipping: new Prisma.Decimal(0),
        tax: new Prisma.Decimal(orderTaxTotal),
        cgst: new Prisma.Decimal(orderCgstTotal),
        sgst: new Prisma.Decimal(orderSgstTotal),
        igst: new Prisma.Decimal(orderIgstTotal),
        total: subtotal,
        items: { create: items },
      },
      select: { id: true, number: true, userId: true },
    })

    return order
  })
}

export async function markOrdersPaid(orderIds: string[]) {
  await assertPermission("orders.manage")
  const prisma = getPrisma()
  const confirmed = await prisma.order.updateMany({
    where: { id: { in: orderIds }, status: "PENDING" },
    data: { status: "CONFIRMED", paymentStatus: "PAID" },
  })
  // Delivered COD orders: record the cash as collected.
  const collected = await prisma.order.updateMany({
    where: { id: { in: orderIds }, status: "FULFILLED", paymentStatus: "UNPAID" },
    data: { paymentStatus: "PAID" },
  })

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, userId: true },
  })
  return {
    count: confirmed.count + collected.count,
    orderIds: orders.map((order) => order.id),
    customerIds: orders.flatMap((order) => order.userId ? [order.userId] : []),
  }
}

/** Courier + tracking number shown to the customer in their account. */
export async function updateOrderTracking(
  orderId: string,
  input: { courier: string; trackingNumber: string; trackingUrl: string },
) {
  await assertPermission("orders.manage")
  return getPrisma().order.update({
    where: { id: orderId },
    data: {
      courier: input.courier.trim() || null,
      trackingNumber: input.trackingNumber.trim() || null,
      trackingUrl: input.trackingUrl.trim() || null,
    },
    select: { id: true, userId: true, status: true },
  })
}

export async function fulfillOrders(orderIds: string[]) {
  await assertPermission("orders.manage")
  const prisma = getPrisma()

  return prisma.$transaction(async (tx) => {
    // Prepaid orders are fulfilled once confirmed; cash-on-delivery orders can
    // ship straight away (payment is collected on delivery).
    const orders = await tx.order.findMany({
      where: {
        id: { in: orderIds },
        OR: [{ status: "CONFIRMED" }, { status: "PENDING", paymentMethod: "COD" }],
      },
      select: {
        id: true,
        userId: true,
        source: true,
        items: { select: { variantId: true, quantity: true } },
      },
    })
    const requestedByVariant = new Map<string, number>()
    for (const order of orders) {
      // Storefront orders reserve stock at checkout; only admin-created orders
      // draw down inventory at fulfilment.
      if (order.source === "STOREFRONT") continue
      for (const item of order.items) {
        if (!item.variantId) continue
        requestedByVariant.set(
          item.variantId,
          (requestedByVariant.get(item.variantId) ?? 0) + item.quantity,
        )
      }
    }
    for (const [variantId, quantity] of requestedByVariant) {
      const updated = await tx.productVariant.updateMany({
        where: { id: variantId, inventoryQuantity: { gte: quantity } },
        data: { inventoryQuantity: { decrement: quantity } },
      })

      if (updated.count !== 1) {
        throw new Error("One or more order items no longer have enough inventory to fulfill.")
      }
    }
    await tx.order.updateMany({
      where: { id: { in: orders.map((order) => order.id) } },
      data: { status: "FULFILLED" },
    })

    return {
      count: orders.length,
      orderIds: orders.map((order) => order.id),
      customerIds: orders.flatMap((order) => order.userId ? [order.userId] : []),
    }
  })
}

export async function cancelOrders(orderIds: string[], reason?: string) {
  await assertPermission("orders.manage")
  return cancelOrdersWithoutPermissionCheck(orderIds, reason ?? "Cancelled by store")
}

/**
 * Cancels open orders and releases reserved stock. Callers must authorise the
 * request themselves (admin permission, or the customer's own order).
 */
export async function cancelOrdersWithoutPermissionCheck(orderIds: string[], reason: string) {
  const prisma = getPrisma()

  return prisma.$transaction(async (tx) => {
    const orders = await tx.order.findMany({
      where: { id: { in: orderIds }, status: { in: ["PENDING", "CONFIRMED"] } },
      select: {
        id: true,
        userId: true,
        source: true,
        items: { select: { variantId: true, quantity: true } },
      },
    })

    // Storefront orders reserved stock at checkout; release it again.
    const releaseByVariant = new Map<string, number>()
    for (const order of orders) {
      if (order.source !== "STOREFRONT") continue
      for (const item of order.items) {
        if (!item.variantId) continue
        releaseByVariant.set(
          item.variantId,
          (releaseByVariant.get(item.variantId) ?? 0) + item.quantity,
        )
      }
    }
    for (const [variantId, quantity] of releaseByVariant) {
      await tx.productVariant.updateMany({
        where: { id: variantId },
        data: { inventoryQuantity: { increment: quantity } },
      })
    }

    const updated = await tx.order.updateMany({
      where: { id: { in: orders.map((order) => order.id) } },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason.slice(0, 300) },
    })

    return {
      count: updated.count,
      orderIds: orders.map((order) => order.id),
      customerIds: orders.flatMap((order) => order.userId ? [order.userId] : []),
    }
  })
}
