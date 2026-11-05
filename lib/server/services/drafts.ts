import "server-only"

import { Prisma } from "@/generated/prisma/client"
import { assertPermission } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"
import type { OrderCreateInput } from "@/lib/validations/order"

export async function createDraftOrder(input: OrderCreateInput) {
  await assertPermission("orders.manage")
  const prisma = getPrisma()

  return prisma.$transaction(async (tx) => {
    const [customer, variants] = await Promise.all([
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
          product: { select: { title: true, status: true } },
        },
      }),
    ])

    if (input.customerId && !customer) {
      throw new Error("The selected customer no longer exists.")
    }
    if (variants.length !== input.items.length) {
      throw new Error("One or more selected products no longer exist.")
    }
    if (variants.some((variant) => variant.product.status === "ARCHIVED")) {
      throw new Error("Archived products cannot be added to a draft.")
    }

    const variantsById = new Map(variants.map((variant) => [variant.id, variant]))
    const items = input.items.map((item) => {
      const variant = variantsById.get(item.variantId)!
      const total = variant.price.mul(item.quantity)
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
      }
    })
    const subtotal = items.reduce(
      (sum, item) => sum.plus(item.total),
      new Prisma.Decimal(0),
    )

    return tx.draftOrder.create({
      data: {
        userId: customer?.id ?? null,
        email: customer?.email ?? input.email!,
        currency: "INR",
        subtotal,
        discount: new Prisma.Decimal(0),
        shipping: new Prisma.Decimal(0),
        total: subtotal,
        items: { create: items },
      },
      select: { id: true, number: true, userId: true },
    })
  })
}

export async function sendDraftOrders(draftIds: string[]) {
  await assertPermission("orders.manage")
  const prisma = getPrisma()
  const drafts = await prisma.draftOrder.findMany({
    where: { id: { in: draftIds }, status: "DRAFT" },
    select: { id: true, userId: true },
  })
  const updated = await prisma.draftOrder.updateMany({
    where: { id: { in: drafts.map((draft) => draft.id) } },
    data: { status: "SENT" },
  })

  return { count: updated.count, draftIds: drafts.map((draft) => draft.id), customerIds: drafts.flatMap((draft) => draft.userId ? [draft.userId] : []) }
}

export async function convertDraftOrders(draftIds: string[]) {
  await assertPermission("orders.manage")
  const prisma = getPrisma()

  return prisma.$transaction(async (tx) => {
    const drafts = await tx.draftOrder.findMany({
      where: { id: { in: draftIds }, status: { in: ["DRAFT", "SENT"] } },
      select: {
        id: true,
        userId: true,
        email: true,
        currency: true,
        subtotal: true,
        discount: true,
        shipping: true,
        total: true,
        items: {
          select: {
            variantId: true,
            title: true,
            sku: true,
            quantity: true,
            unitPrice: true,
            total: true,
          },
        },
      },
    })
    const orders = await Promise.all(
      drafts.map((draft) =>
        tx.order.create({
          data: {
            userId: draft.userId,
            email: draft.email,
            status: "PENDING",
            currency: draft.currency,
            subtotal: draft.subtotal,
            discount: draft.discount,
            shipping: draft.shipping,
            total: draft.total,
            items: { create: draft.items },
          },
          select: { id: true },
        }),
      ),
    )
    await tx.draftOrder.updateMany({
      where: { id: { in: drafts.map((draft) => draft.id) } },
      data: { status: "COMPLETED" },
    })

    return {
      count: drafts.length,
      draftIds: drafts.map((draft) => draft.id),
      orderIds: orders.map((order) => order.id),
      customerIds: drafts.flatMap((draft) => draft.userId ? [draft.userId] : []),
    }
  })
}

export async function deleteDraftOrders(draftIds: string[]) {
  await assertPermission("orders.manage")
  const prisma = getPrisma()
  const drafts = await prisma.draftOrder.findMany({
    where: { id: { in: draftIds }, status: { in: ["DRAFT", "SENT"] } },
    select: { id: true, userId: true },
  })

  const deleted = await prisma.draftOrder.deleteMany({
    where: { id: { in: drafts.map((draft) => draft.id) } },
  })

  return {
    count: deleted.count,
    draftIds: drafts.map((draft) => draft.id),
    customerIds: drafts.flatMap((draft) => (draft.userId ? [draft.userId] : [])),
  }
}
