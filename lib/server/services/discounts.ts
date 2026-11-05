import "server-only"

import { Prisma } from "@/generated/prisma/client"
import { assertPermission } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"
import type { DiscountInput } from "@/lib/validations/discount"

function unique(ids: string[]) {
  return [...new Set(ids)]
}

async function validateTargets(tx: Prisma.TransactionClient, input: DiscountInput) {
  const productIds = unique([...input.productIds, ...input.buyProductIds, ...input.getProductIds])
  const collectionIds = unique(input.collectionIds)
  const [products, collections] = await Promise.all([
    productIds.length
      ? tx.product.findMany({ where: { id: { in: productIds }, status: { not: "ARCHIVED" } }, select: { id: true } })
      : [],
    collectionIds.length
      ? tx.collection.findMany({ where: { id: { in: collectionIds } }, select: { id: true } })
      : [],
  ])
  if (products.length !== productIds.length) throw new Error("One or more selected products are no longer available.")
  if (collections.length !== collectionIds.length) throw new Error("One or more selected collections no longer exist.")
}

function discountData(input: DiscountInput) {
  const minimumQuantity = input.minimumType === "QUANTITY" ? input.minimumValue ?? null : null
  return {
    title: input.title,
    code: input.method === "CODE" ? input.code! : null,
    type: input.type,
    method: input.method,
    status: input.status,
    valueType: input.type === "FREE_SHIPPING" ? "FREE" as const : input.valueType,
    value: input.valueType === "FREE" ? null : new Prisma.Decimal(input.value!),
    appliesTo: input.type === "PRODUCT" ? input.appliesTo : "ALL" as const,
    productIds: unique(input.type === "PRODUCT" ? input.productIds : []),
    collectionIds: unique(input.type === "PRODUCT" ? input.collectionIds : []),
    buyProductIds: unique(input.type === "BUY_X_GET_Y" ? input.buyProductIds : []),
    getProductIds: unique(input.type === "BUY_X_GET_Y" ? input.getProductIds : []),
    eligibility: "ALL",
    minimumType: input.minimumType,
    minimumQuantity,
    minimumAmount: input.minimumType === "AMOUNT" ? new Prisma.Decimal(input.minimumValue!) : null,
    usageLimit: input.usageLimit ?? null,
    onePerCustomer: input.onePerCustomer,
    startsAt: new Date(input.startsAt),
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    config: { version: 1 },
  }
}

export async function createDiscount(input: DiscountInput) {
  await assertPermission("discounts.manage")
  return getPrisma().$transaction(async (tx) => {
    await validateTargets(tx, input)
    return tx.discount.create({ data: discountData(input), select: { id: true } })
  })
}

export async function updateDiscount(id: string, input: DiscountInput) {
  await assertPermission("discounts.manage")
  return getPrisma().$transaction(async (tx) => {
    const existing = await tx.discount.findUnique({ where: { id }, select: { id: true } })
    if (!existing) throw new Error("This discount no longer exists.")
    await validateTargets(tx, input)
    return tx.discount.update({ where: { id }, data: discountData(input), select: { id: true } })
  })
}

export async function setDiscountStatus(ids: string[], status: "ACTIVE" | "INACTIVE") {
  await assertPermission("discounts.manage")
  const updated = await getPrisma().discount.updateMany({ where: { id: { in: ids } }, data: { status } })
  return { count: updated.count, ids }
}

export async function deleteDiscounts(ids: string[]) {
  await assertPermission("discounts.delete")
  const deleted = await getPrisma().discount.deleteMany({ where: { id: { in: ids } } })
  return { count: deleted.count, ids }
}
