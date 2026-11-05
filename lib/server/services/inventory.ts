import "server-only"

import { assertPermission } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"
import type {
  InventoryAdjustment,
  InventoryImport,
} from "@/lib/validations/inventory"

export async function updateInventoryQuantities(
  updates: InventoryAdjustment[],
) {
  await assertPermission("inventory.manage")
  const prisma = getPrisma()
  const variantIds = updates.map((update) => update.variantId)

  return prisma.$transaction(async (tx) => {
    const variants = await tx.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, productId: true },
    })
    if (variants.length !== variantIds.length) {
      throw new Error("One or more inventory items no longer exist.")
    }

    await Promise.all(
      updates.map((update) =>
        tx.productVariant.update({
          where: { id: update.variantId },
          data: { inventoryQuantity: update.onHand },
        }),
      ),
    )

    return { count: updates.length, productIds: variants.map((variant) => variant.productId) }
  })
}

export async function importInventoryQuantities(updates: InventoryImport) {
  await assertPermission("inventory.manage")
  const prisma = getPrisma()
  const skus = updates.map((update) => update.sku)

  return prisma.$transaction(async (tx) => {
    const variants = await tx.productVariant.findMany({
      where: { sku: { in: skus } },
      select: { id: true, sku: true, productId: true },
    })
    if (variants.length !== skus.length) {
      const foundSkus = new Set(variants.map((variant) => variant.sku))
      const missingSku = skus.find((sku) => !foundSkus.has(sku))
      throw new Error(`No product variant exists for SKU ${missingSku ?? "in the import"}.`)
    }

    const variantsBySku = new Map(variants.map((variant) => [variant.sku, variant]))
    await Promise.all(
      updates.map((update) =>
        tx.productVariant.update({
          where: { id: variantsBySku.get(update.sku)!.id },
          data: { inventoryQuantity: update.onHand },
        }),
      ),
    )

    return { count: updates.length, productIds: variants.map((variant) => variant.productId) }
  })
}
