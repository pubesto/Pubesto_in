import "server-only"

import { Prisma } from "@/generated/prisma/client"
import { assertPermission } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"

export async function recoverAbandonedCheckouts(cartIds: string[]) {
  await assertPermission("orders.manage")
  const prisma = getPrisma()

  return prisma.$transaction(async (tx) => {
    const carts = await tx.cart.findMany({
      where: { id: { in: cartIds }, items: { some: {} } },
      select: {
        id: true,
        user: { select: { id: true, email: true } },
        items: {
          select: {
            variantId: true,
            quantity: true,
            variant: {
              select: {
                title: true,
                sku: true,
                price: true,
                product: { select: { title: true } },
              },
            },
          },
        },
      },
    })
    const orders = await Promise.all(
      carts.map((cart) => {
        const items = cart.items.map((item) => {
          const total = item.variant.price.mul(item.quantity)
          return {
            variantId: item.variantId,
            title:
              item.variant.title === "Default"
                ? item.variant.product.title
                : `${item.variant.product.title} · ${item.variant.title}`,
            sku: item.variant.sku,
            quantity: item.quantity,
            unitPrice: item.variant.price,
            total,
          }
        })
        const subtotal = items.reduce(
          (sum, item) => sum.plus(item.total),
          new Prisma.Decimal(0),
        )
        return tx.order.create({
          data: {
            userId: cart.user.id,
            email: cart.user.email,
            status: "PENDING",
            currency: "INR",
            subtotal,
            discount: new Prisma.Decimal(0),
            shipping: new Prisma.Decimal(0),
            total: subtotal,
            items: { create: items },
          },
          select: { id: true },
        })
      }),
    )
    await tx.cartItem.deleteMany({ where: { cartId: { in: carts.map((cart) => cart.id) } } })

    return {
      count: carts.length,
      cartIds: carts.map((cart) => cart.id),
      orderIds: orders.map((order) => order.id),
      customerIds: carts.map((cart) => cart.user.id),
    }
  })
}

export async function clearAbandonedCheckouts(cartIds: string[]) {
  await assertPermission("orders.manage")
  const prisma = getPrisma()
  const carts = await prisma.cart.findMany({
    where: { id: { in: cartIds }, items: { some: {} } },
    select: { id: true, userId: true },
  })
  await prisma.cartItem.deleteMany({ where: { cartId: { in: carts.map((cart) => cart.id) } } })

  return {
    count: carts.length,
    cartIds: carts.map((cart) => cart.id),
    customerIds: carts.map((cart) => cart.userId),
  }
}
