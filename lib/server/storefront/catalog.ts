import "server-only"

import { cache } from "react"

import { parseProductPageContent } from "@/lib/product-page-content"
import { getPrisma } from "@/lib/server/db"
import { mediaUrl } from "@/lib/server/media"

/** Collections that drive homepage rows rather than shopping categories. */
export const FEATURED_COLLECTION_SLUGS = ["featured", "frontpage"]

const PLACEHOLDER_IMAGE = "https://placehold.co/600x600/1b624b/ffffff?text=Pubesto"

const FALLBACK_SWATCHES: Record<string, string> = {
  green: "#2E5A44",
  "forest green": "#2D4B3F",
  white: "#F5F5F5",
  "arctic white": "#F5F5F5",
  black: "#1A1A1A",
  blue: "#3A6073",
  pink: "#E8C2C2",
  "blush pink": "#E8C2C2",
  orange: "#E67E22",
  yellow: "#F1C40F",
  silver: "#BDC3C7",
  grey: "#9CA3AF",
  gray: "#9CA3AF",
  red: "#C0392B",
  purple: "#8E44AD",
}

export type StorefrontVariant = {
  id: string
  title: string
  sku: string
  price: number
  compareAtPrice: number | null
  color: string | null
  size: string | null
  selectedOptions: { name: string; value: string }[]
  inventory: number
  available: boolean
}

export type StorefrontColor = {
  name: string
  hex: string
  image: string | null
  available: boolean
  variantId: string
}

/** Product in the shape the Pubesto storefront components already use. */
export type StorefrontProduct = {
  id: string
  name: string
  slug: string
  description: string
  image: string
  gallery: string[]
  price: string
  oldPrice: string | null
  salePrice: number
  originalPrice: number | null
  categories: string[]
  createdAt: string
  tags: string[]
  salesRank: number | null
  featuredRank: number | null
  inStock: boolean
  highlights: string[]
  specifications: Record<string, string> | null
  detail: string | null
  badge: string | null
  badgeClass: string
  rating: string | null
  reviews: string | null
  colors: StorefrontColor[] | undefined
  variants: StorefrontVariant[]
  variantId: string | null
  sku: string
  videoUrl: string | null
  /** Admin → product → Search engine listing; empty = fall back to title/description. */
  seoTitle: string
  seoDescription: string
}

export type StorefrontCategory = {
  name: string
  label: string
  slug: string
  image: string
}

function inr(value: number) {
  return `₹${value.toLocaleString("en-IN")}`
}

export function readVariantOption(optionValues: unknown, name: "color" | "size"): string | null {
  if (!optionValues || typeof optionValues !== "object" || Array.isArray(optionValues)) return null
  for (const [key, value] of Object.entries(optionValues as Record<string, unknown>)) {
    const normalized = key.toLowerCase()
    if (normalized !== name && !(name === "color" && normalized === "colour")) continue
    if (typeof value === "string" && value.trim()) return value.trim()
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>
      const candidate = record.name ?? record.value ?? record.label
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim()
    }
  }
  return null
}

async function loadRanks() {
  const prisma = getPrisma()
  const [sold, featured] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ["variantId"],
      where: { variantId: { not: null }, order: { status: { not: "CANCELLED" } } },
      _sum: { quantity: true },
    }),
    prisma.collection.findMany({
      where: { slug: { in: FEATURED_COLLECTION_SLUGS } },
      select: {
        slug: true,
        products: { orderBy: { position: "asc" }, select: { productId: true } },
      },
    }),
  ])

  const variantIds = sold.map((row) => row.variantId).filter((id): id is string => Boolean(id))
  const variants = variantIds.length
    ? await prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: { id: true, productId: true },
      })
    : []
  const productOfVariant = new Map(variants.map((variant) => [variant.id, variant.productId]))
  const unitsByProduct = new Map<string, number>()
  for (const row of sold) {
    const productId = row.variantId ? productOfVariant.get(row.variantId) : undefined
    if (!productId) continue
    unitsByProduct.set(productId, (unitsByProduct.get(productId) ?? 0) + (row._sum.quantity ?? 0))
  }
  const salesRanks = new Map(
    [...unitsByProduct.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([productId], index) => [productId, index + 1]),
  )

  // A "featured" collection takes priority over "frontpage" (Shopify's "Home page").
  const featuredCollection =
    featured.find((collection) => collection.slug === "featured" && collection.products.length) ??
    featured.find((collection) => collection.slug === "frontpage")
  const featuredRanks = new Map(
    (featuredCollection?.products ?? []).map((entry, index) => [entry.productId, index + 1]),
  )

  return { salesRanks, featuredRanks }
}

async function loadCatalog() {
  const prisma = getPrisma()
  const [rows, collections, ranks] = await Promise.all([
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        tags: true,
        details: true,
        pageContent: true,
        createdAt: true,
        category: { select: { name: true, status: true, visible: true } },
        images: { orderBy: { position: "asc" }, select: { objectKey: true } },
        variants: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            title: true,
            sku: true,
            price: true,
            compareAtPrice: true,
            inventoryQuantity: true,
            optionValues: true,
          },
        },
        collections: {
          select: { collection: { select: { title: true, slug: true, isPublished: true } } },
        },
      },
    }),
    prisma.collection.findMany({
      where: { isPublished: true, slug: { notIn: FEATURED_COLLECTION_SLUGS } },
      orderBy: { createdAt: "asc" },
      select: { title: true, slug: true, imageObjectKey: true },
    }),
    loadRanks(),
  ])

  const products: StorefrontProduct[] = rows
    .filter((row) => row.variants.length > 0)
    .map((row) => {
      const content = parseProductPageContent(row.pageContent)
      const gallery = row.images
        .map((image) => mediaUrl(image.objectKey))
        .filter((url): url is string => Boolean(url))
      const image = gallery[0] ?? PLACEHOLDER_IMAGE

      const variants: StorefrontVariant[] = row.variants.map((variant) => {
        const color = readVariantOption(variant.optionValues, "color")
        const size = readVariantOption(variant.optionValues, "size")
        return {
          id: variant.id,
          title: variant.title,
          sku: variant.sku,
          price: Number(variant.price),
          compareAtPrice: variant.compareAtPrice === null ? null : Number(variant.compareAtPrice),
          color,
          size,
          selectedOptions: [
            ...(color ? [{ name: "Color", value: color }] : []),
            ...(size ? [{ name: "Size", value: size }] : []),
          ],
          inventory: variant.inventoryQuantity,
          available: variant.inventoryQuantity > 0,
        }
      })

      const primary = variants.find((variant) => variant.available) ?? variants[0]!
      const salePrice = primary.price
      const originalPrice =
        primary.compareAtPrice !== null && primary.compareAtPrice > salePrice ? primary.compareAtPrice : null
      const percentOff = originalPrice ? Math.round(((originalPrice - salePrice) / originalPrice) * 100) : 0

      const colorMap = new Map<string, StorefrontColor>()
      for (const variant of variants) {
        if (!variant.color) continue
        const key = variant.color.toLowerCase()
        const existing = colorMap.get(key)
        if (existing) {
          existing.available ||= variant.available
          continue
        }
        const swatch =
          content.colorSwatches[variant.color] ??
          Object.entries(content.colorSwatches).find(([name]) => name.toLowerCase() === key)?.[1] ??
          FALLBACK_SWATCHES[key] ??
          "#D1D5DB"
        const colorImageKey =
          content.colorImages[variant.color] ??
          Object.entries(content.colorImages).find(([name]) => name.toLowerCase() === key)?.[1]
        colorMap.set(key, {
          name: variant.color,
          hex: swatch,
          image: mediaUrl(colorImageKey) ?? image,
          available: variant.available,
          variantId: variant.id,
        })
      }

      const details = Array.isArray(row.details) ? (row.details as { name?: string; value?: string }[]) : []
      const specifications = Object.fromEntries(
        details
          .filter((detail) => detail?.name && detail?.value)
          .map((detail) => [String(detail.name), String(detail.value)]),
      )

      const categories = [
        ...row.collections
          .map(({ collection }) => collection)
          .filter(
            (collection) => collection.isPublished && !FEATURED_COLLECTION_SLUGS.includes(collection.slug),
          )
          .map((collection) => collection.title),
        ...(row.category && row.category.status === "ACTIVE" && row.category.visible ? [row.category.name] : []),
      ]

      return {
        id: row.id,
        name: row.title,
        slug: row.slug,
        description: row.description ?? "",
        image,
        gallery,
        price: inr(salePrice),
        oldPrice: originalPrice ? inr(originalPrice) : null,
        salePrice,
        originalPrice,
        categories: [...new Set(categories)],
        createdAt: row.createdAt.toISOString(),
        tags: row.tags,
        salesRank: ranks.salesRanks.get(row.id) ?? null,
        featuredRank: ranks.featuredRanks.get(row.id) ?? null,
        inStock: variants.some((variant) => variant.available),
        highlights: content.bulletHighlights.map((line) => line.trim()).filter(Boolean),
        specifications: Object.keys(specifications).length ? specifications : null,
        detail: content.detailLine || null,
        badge: content.badge || (percentOff > 0 ? `${percentOff}% OFF` : null),
        badgeClass: "badge-discount",
        rating: content.rating || null,
        reviews: content.reviewCount || null,
        colors: colorMap.size ? [...colorMap.values()] : undefined,
        variants,
        variantId: primary.id,
        sku: primary.sku,
        videoUrl: content.videoUrl || null,
        seoTitle: content.seoTitle,
        seoDescription: content.seoDescription,
      }
    })

  const categories: StorefrontCategory[] = collections.map((collection) => ({
    name: collection.title,
    label: collection.title,
    slug: collection.slug,
    image: mediaUrl(collection.imageObjectKey) ?? "https://placehold.co/600x600/1b624b/ffffff?text=Category",
  }))

  return { products, categories }
}

/** Active products and published categories, loaded once per request. */
export const getStorefrontCatalog = cache(async () => {
  try {
    return await loadCatalog()
  } catch (error) {
    console.error("[storefront] failed to load catalog", error)
    return { products: [] as StorefrontProduct[], categories: [] as StorefrontCategory[] }
  }
})
