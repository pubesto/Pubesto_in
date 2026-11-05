import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { getPrisma } from "@/lib/server/db"
import type { CheckoutItemInput } from "@/lib/validations/checkout"

type VariantRow = {
  id: string
  title: string
  sku: string
  price: Prisma.Decimal
  inventoryQuantity: number
  optionValues: Prisma.JsonValue | null
}

export type ResolvedCartLine = {
  input: CheckoutItemInput
  product: {
    id: string
    title: string
    status: "DRAFT" | "ACTIVE" | "ARCHIVED"
    taxRate: Prisma.Decimal | null
    hsnCode: string | null
    isTaxExempt: boolean
  } | null
  variant: VariantRow | null
  reason?: string
}

function optionOf(optionValues: Prisma.JsonValue | null, name: "size" | "color"): string | null {
  if (!optionValues || typeof optionValues !== "object" || Array.isArray(optionValues)) {
    return null
  }
  for (const [key, value] of Object.entries(optionValues as Record<string, unknown>)) {
    const normalized = key.toLowerCase()
    if (normalized !== name && !(name === "color" && normalized === "colour")) continue
    if (typeof value === "string") return value.trim().toUpperCase()
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>
      const candidate = record.value ?? record.name ?? record.label
      if (typeof candidate === "string") return candidate.trim().toUpperCase()
    }
  }
  return null
}

const sizeOf = (optionValues: Prisma.JsonValue | null) => optionOf(optionValues, "size")
const colorOf = (optionValues: Prisma.JsonValue | null) => optionOf(optionValues, "color")

/**
 * Maps storefront cart lines onto concrete variants: the exact variant id when
 * the storefront sent one, otherwise the chosen color / size, otherwise the
 * first variant in stock. This is the single place that decides which SKU a
 * shopper actually bought.
 */
export async function resolveCartLines(
  tx: Prisma.TransactionClient,
  items: CheckoutItemInput[],
): Promise<ResolvedCartLine[]> {
  const keys = [...new Set(items.map((item) => item.productId))]
  const products = await tx.product.findMany({
    where: { OR: [{ id: { in: keys } }, { slug: { in: keys } }] },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      taxRate: true,
      hsnCode: true,
      isTaxExempt: true,
      variants: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          sku: true,
          price: true,
          inventoryQuantity: true,
          optionValues: true,
        },
      },
    },
  })
  const productsByKey = new Map<string, (typeof products)[number]>()
  for (const product of products) {
    productsByKey.set(product.id, product)
    productsByKey.set(product.slug, product)
  }

  return items.map((input) => {
    const product = productsByKey.get(input.productId)
    if (!product) {
      return { input, product: null, variant: null, reason: "This product is no longer available." }
    }

    const wantedSize = input.size.trim().toUpperCase()
    const wantedColor = input.color.trim().toUpperCase()
    const inStockFirst = [...product.variants].sort(
      (a, b) => Number(b.inventoryQuantity > 0) - Number(a.inventoryQuantity > 0),
    )

    let variant: VariantRow | undefined = input.variantId
      ? product.variants.find((candidate) => candidate.id === input.variantId)
      : undefined

    if (!variant) {
      let candidates = inStockFirst
      if (wantedColor && candidates.some((candidate) => colorOf(candidate.optionValues) !== null)) {
        candidates = candidates.filter((candidate) => colorOf(candidate.optionValues) === wantedColor)
      }
      if (wantedSize && candidates.some((candidate) => sizeOf(candidate.optionValues) !== null)) {
        candidates = candidates.filter((candidate) => sizeOf(candidate.optionValues) === wantedSize)
      }
      variant = candidates[0]
    }

    const { variants: _variants, slug: _slug, ...productInfo } = product
    void _variants
    void _slug

    if (!variant) {
      const choice = [input.color, input.size].filter(Boolean).join(" / ") || "selected option"
      return {
        input,
        product: productInfo,
        variant: null,
        reason: `${choice} is no longer available for ${product.title}.`,
      }
    }

    return { input, product: productInfo, variant }
  })
}

/**
 * Mirrors a signed-in shopper's browser cart into the database so the
 * dashboard's abandoned-checkout view reflects real carts.
 */
export async function syncUserCart(userId: string, items: CheckoutItemInput[]) {
  const prisma = getPrisma()

  return prisma.$transaction(async (tx) => {
    const cart = await tx.cart.upsert({
      where: { userId },
      create: { userId },
      update: { updatedAt: new Date() },
      select: { id: true },
    })

    const lines = await resolveCartLines(tx, items)
    const quantities = new Map<string, number>()
    for (const line of lines) {
      if (!line.variant || line.product?.status !== "ACTIVE") continue
      quantities.set(line.variant.id, (quantities.get(line.variant.id) ?? 0) + line.input.quantity)
    }

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } })
    if (quantities.size) {
      await tx.cartItem.createMany({
        data: [...quantities].map(([variantId, quantity]) => ({
          cartId: cart.id,
          variantId,
          quantity: Math.min(quantity, 20),
        })),
      })
    }

    return { cartId: cart.id, lineCount: quantities.size }
  })
}

export async function clearUserCart(tx: Prisma.TransactionClient, userId: string) {
  const cart = await tx.cart.findUnique({ where: { userId }, select: { id: true } })
  if (cart) {
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } })
  }
}
