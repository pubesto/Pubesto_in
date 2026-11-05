import "server-only"

import { requirePermission } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"

function imageUrl(objectKey: string | null) {
  if (!objectKey) return null

  if (objectKey.startsWith("/")) {
    return objectKey
  }

  if (objectKey.startsWith("uploads/")) {
    return `/${objectKey}`
  }

  const baseUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "")
  return baseUrl ? `${baseUrl}/${objectKey}` : null
}

export type AdminInventoryItem = {
  variantId: string
  productId: string
  productTitle: string
  productSlug: string
  variantTitle: string
  sku: string
  unavailable: number
  committed: number
  available: number
  onHand: number
  incoming: number
  image: { url: string | null; altText: string | null } | null
}

export async function listInventoryForAdmin(): Promise<AdminInventoryItem[]> {
  await requirePermission("inventory.view")
  const prisma = getPrisma()
  const variants = await prisma.productVariant.findMany({
    orderBy: [{ product: { title: "asc" } }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      sku: true,
      inventoryQuantity: true,
      product: {
        select: {
          id: true,
          title: true,
          slug: true,
          images: {
            orderBy: { position: "asc" },
            take: 1,
            select: { objectKey: true, altText: true },
          },
        },
      },
      orderItems: {
        where: { order: { status: { in: ["PENDING", "CONFIRMED"] } } },
        select: { quantity: true },
      },
    },
  })

  return variants.map((variant) => {
    const committed = variant.orderItems.reduce(
      (total, item) => total + item.quantity,
      0,
    )
    const image = variant.product.images[0]
    const onHand = variant.inventoryQuantity

    return {
      variantId: variant.id,
      productId: variant.product.id,
      productTitle: variant.product.title,
      productSlug: variant.product.slug,
      variantTitle: variant.title,
      sku: variant.sku,
      unavailable: 0,
      committed,
      available: Math.max(onHand - committed, 0),
      onHand,
      incoming: 0,
      image: image
        ? { url: imageUrl(image.objectKey), altText: image.altText }
        : null,
    }
  })
}
