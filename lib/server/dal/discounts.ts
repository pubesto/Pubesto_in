import "server-only"

import { requirePermission } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"

export type AdminDiscountListItem = {
  id: string
  title: string
  code: string | null
  type: "PRODUCT" | "ORDER" | "BUY_X_GET_Y" | "FREE_SHIPPING"
  method: "CODE" | "AUTOMATIC"
  status: "ACTIVE" | "INACTIVE"
  valueType: "PERCENTAGE" | "FIXED" | "FREE"
  value: number | null
  appliesTo: "ALL" | "PRODUCTS" | "COLLECTIONS"
  productCount: number
  collectionCount: number
  buyProductCount: number
  getProductCount: number
  minimumType: "NONE" | "AMOUNT" | "QUANTITY"
  minimumValue: number | null
  usageLimit: number | null
  onePerCustomer: boolean
  usageCount: number
  startsAt: string
  endsAt: string | null
}

export type AdminDiscountEditor = Omit<AdminDiscountListItem, "productCount" | "collectionCount" | "buyProductCount" | "getProductCount"> & {
  productIds: string[]
  collectionIds: string[]
  buyProductIds: string[]
  getProductIds: string[]
}

export type AdminDiscountOption = { id: string; title: string }

function mapDiscount(discount: {
  id: string
  title: string
  code: string | null
  type: AdminDiscountListItem["type"]
  method: AdminDiscountListItem["method"]
  status: AdminDiscountListItem["status"]
  valueType: AdminDiscountListItem["valueType"]
  value: { toString(): string } | null
  appliesTo: AdminDiscountListItem["appliesTo"]
  productIds: string[]
  collectionIds: string[]
  buyProductIds: string[]
  getProductIds: string[]
  minimumType: string
  minimumQuantity: number | null
  minimumAmount: { toString(): string } | null
  usageLimit: number | null
  onePerCustomer: boolean
  usageCount: number
  startsAt: Date
  endsAt: Date | null
}): AdminDiscountEditor {
  const minimumType = discount.minimumType as AdminDiscountListItem["minimumType"]
  return {
    id: discount.id,
    title: discount.title,
    code: discount.code,
    type: discount.type,
    method: discount.method,
    status: discount.status,
    valueType: discount.valueType,
    value: discount.value ? Number(discount.value) : null,
    appliesTo: discount.appliesTo,
    productIds: discount.productIds,
    collectionIds: discount.collectionIds,
    buyProductIds: discount.buyProductIds,
    getProductIds: discount.getProductIds,
    minimumType,
    minimumValue: minimumType === "QUANTITY" ? discount.minimumQuantity : discount.minimumAmount ? Number(discount.minimumAmount) : null,
    usageLimit: discount.usageLimit,
    onePerCustomer: discount.onePerCustomer,
    usageCount: discount.usageCount,
    startsAt: discount.startsAt.toISOString(),
    endsAt: discount.endsAt?.toISOString() ?? null,
  }
}

const discountSelect = {
  id: true,
  title: true,
  code: true,
  type: true,
  method: true,
  status: true,
  valueType: true,
  value: true,
  appliesTo: true,
  productIds: true,
  collectionIds: true,
  buyProductIds: true,
  getProductIds: true,
  minimumType: true,
  minimumQuantity: true,
  minimumAmount: true,
  usageLimit: true,
  onePerCustomer: true,
  usageCount: true,
  startsAt: true,
  endsAt: true,
} as const

export async function listDiscountsForAdmin(): Promise<AdminDiscountListItem[]> {
  await requirePermission("discounts.view")
  const discounts = await getPrisma().discount.findMany({
    orderBy: { updatedAt: "desc" },
    select: discountSelect,
  })

  return discounts.map((discount) => {
    const mapped = mapDiscount(discount)
    return {
      ...mapped,
      productCount: mapped.productIds.length,
      collectionCount: mapped.collectionIds.length,
      buyProductCount: mapped.buyProductIds.length,
      getProductCount: mapped.getProductIds.length,
    }
  })
}

export async function getDiscountForAdmin(id: string): Promise<AdminDiscountEditor | null> {
  await requirePermission("discounts.view")
  const discount = await getPrisma().discount.findUnique({ where: { id }, select: discountSelect })
  return discount ? mapDiscount(discount) : null
}

export async function listDiscountEditorOptionsForAdmin(): Promise<{
  products: AdminDiscountOption[]
  collections: AdminDiscountOption[]
}> {
  await requirePermission("discounts.view")
  const prisma = getPrisma()
  const [products, collections] = await Promise.all([
    prisma.product.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
    prisma.collection.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ])
  return { products, collections }
}

export type StorefrontOffer = {
  code: string
  headline: string
  detail: string | null
}

function formatRupees(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`
}

/**
 * Coupon codes to advertise on product pages. Mirrors what checkout will
 * actually accept (see resolvePromoCode): active CODE discounts inside their
 * date window, under their usage limit, and order-wide. Never throws, so a
 * discounts problem can't take the product page down.
 */
export async function listStorefrontOffers(limit = 3, codes: string[] = []): Promise<StorefrontOffer[]> {
  try {
    const now = new Date()
    const discounts = await getPrisma().discount.findMany({
      where: {
        method: "CODE",
        status: "ACTIVE",
        code: { not: null },
        type: { in: ["ORDER", "PRODUCT", "FREE_SHIPPING"] },
        // A product can pick specific codes; otherwise every eligible code is shown.
        ...(codes.length > 0 ? { code: { in: codes } } : {}),
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        code: true,
        type: true,
        valueType: true,
        value: true,
        appliesTo: true,
        minimumType: true,
        minimumAmount: true,
        minimumQuantity: true,
        usageLimit: true,
        usageCount: true,
      },
    })

    return discounts
      .filter((discount) =>
        discount.code &&
        (discount.usageLimit === null || discount.usageCount < discount.usageLimit) &&
        (discount.type === "FREE_SHIPPING" || discount.appliesTo === "ALL"),
      )
      .slice(0, limit)
      .map((discount) => {
        const value = discount.value ? Number(discount.value) : 0
        const headline =
          discount.type === "FREE_SHIPPING"
            ? "Enjoy free shipping"
            : discount.valueType === "PERCENTAGE"
              ? `Enjoy ${value}% off`
              : `Enjoy ${formatRupees(value)} off`
        const detail =
          discount.minimumType === "AMOUNT" && discount.minimumAmount
            ? `on orders above ${formatRupees(Number(discount.minimumAmount))}`
            : discount.minimumType === "QUANTITY" && discount.minimumQuantity
              ? `on ${discount.minimumQuantity} or more items`
              : "on your order"

        return { code: discount.code as string, headline, detail }
      })
  } catch (error) {
    console.error("Error loading storefront offers:", error)
    return []
  }
}

export type AdminDiscountCodeOption = { code: string; title: string; isActive: boolean }

/** Coupon codes for the product page's offer picker. */
export async function listDiscountCodeOptionsForAdmin(): Promise<AdminDiscountCodeOption[]> {
  await requirePermission("products.view")
  const rows = await getPrisma().discount.findMany({
    where: { method: "CODE", code: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { code: true, title: true, status: true, endsAt: true },
  })
  const now = Date.now()
  return rows.map((row) => ({
    code: row.code as string,
    title: row.title,
    isActive: row.status === "ACTIVE" && (!row.endsAt || row.endsAt.getTime() > now),
  }))
}
