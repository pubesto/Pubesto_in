import "server-only"

import { requirePermission } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"

export type AdminAbandonedCheckout = {
  id: string
  customer: { id: string; name: string; email: string }
  createdAt: string
  itemCount: number
  total: number
  currency: string
}

export async function listAbandonedCheckoutsForAdmin(): Promise<
  AdminAbandonedCheckout[]
> {
  await requirePermission("orders.view")
  const carts = await getPrisma().cart.findMany({
    where: { items: { some: {} } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      updatedAt: true,
      user: { select: { id: true, name: true, email: true } },
      items: {
        select: {
          quantity: true,
          variant: { select: { price: true } },
        },
      },
    },
  })

  return carts.map((cart) => ({
    id: cart.id,
    customer: cart.user,
    createdAt: cart.updatedAt.toISOString(),
    itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    total: cart.items.reduce(
      (sum, item) => sum + Number(item.variant.price) * item.quantity,
      0,
    ),
    currency: "INR",
  }))
}

export async function getAbandonedCheckoutForAdmin(cartId: string) {
  await requirePermission("orders.view")
  const cart = await getPrisma().cart.findFirst({
    where: { id: cartId, items: { some: {} } },
    select: {
      id: true,
      updatedAt: true,
      user: { select: { id: true, name: true, email: true } },
      items: {
        select: {
          id: true,
          quantity: true,
          variant: {
            select: {
              id: true,
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
  if (!cart) return null

  const items = cart.items.map((item) => ({
    id: item.id,
    variantId: item.variant.id,
    title:
      item.variant.title === "Default"
        ? item.variant.product.title
        : `${item.variant.product.title} · ${item.variant.title}`,
    sku: item.variant.sku,
    quantity: item.quantity,
    unitPrice: Number(item.variant.price),
    total: Number(item.variant.price) * item.quantity,
  }))

  return {
    id: cart.id,
    customer: cart.user,
    updatedAt: cart.updatedAt.toISOString(),
    currency: "INR",
    items,
    total: items.reduce((sum, item) => sum + item.total, 0),
  }
}
