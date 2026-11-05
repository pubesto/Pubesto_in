import "server-only"

import { getPrisma } from "@/lib/server/db"
import { requirePermission } from "@/lib/server/dal/auth"
import { listStorefrontOffers } from "@/lib/server/dal/discounts"
import {
  modelLine,
  parseProductPageContent,
  SPEC_FIELDS,
  type ProductPageContent,
} from "@/lib/product-page-content"
import { getSiteContent } from "@/lib/server/dal/site-content"

function imageUrl(objectKey: string) {
  if (objectKey.startsWith("/")) {
    return objectKey
  }

  if (objectKey.startsWith("uploads/")) {
    return `/${objectKey}`
  }

  const baseUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "")
  return baseUrl ? `${baseUrl}/${objectKey}` : null
}

export type AdminCollectionOption = {
  id: string
  title: string
}

export type AdminProductListItem = {
  id: string
  title: string
  slug: string
  status: "DRAFT" | "ACTIVE" | "ARCHIVED"
  categoryName: string
  collectionNames: string[]
  tags: string[]
  vendor: string
  sku: string | null
  variantCount: number
  totalInventory: number
  minimumPrice: string | null
  image: { url: string | null; altText: string | null } | null
  updatedAt: string
}

export type AdminProductDetail = {
  id: string
  title: string
  slug: string
  description: string | null
  status: "DRAFT" | "ACTIVE" | "ARCHIVED"
  categoryId: string | null
  categoryName: string
  collectionIds: string[]
  collectionNames: string[]
  tags: string[]
  vendor: string
  details: { name: string; value: string }[]
  pageContent: ProductPageContent
  taxRate: number
  hsnCode: string
  isTaxExempt: boolean
  images: {
    id: string
    objectKey: string
    url: string | null
    altText: string | null
  }[]
  variants: {
    id: string
    title: string
    sku: string
    price: string
    compareAtPrice: string | null
    inventoryQuantity: number
    optionValues: Record<string, any>
  }[]
  createdAt: string
  updatedAt: string
}

export async function listCollectionOptionsForAdmin(): Promise<
  AdminCollectionOption[]
> {
  await requirePermission("products.view")
  const prisma = getPrisma()

  return prisma.collection.findMany({
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  })
}

export const COLOR_SWATCH_MAP: Record<string, string> = {
  black: "#171717",
  white: "#ffffff",
  red: "#ef2b2d",
  blue: "#2563eb",
  green: "#16a34a",
  yellow: "#eab308",
  orange: "#f97316",
  olive: "#808000",
  purple: "#9333ea",
  pink: "#ec4899",
  brown: "#8b5e3c",
  beige: "#d6c3a5",
  cream: "#f5ead2",
  gray: "#6b7280",
  grey: "#6b7280",
  navy: "#1e3a5f",
  teal: "#0f766e",
  cyan: "#06b6d4",
  aqua: "#06b6d4",
  lime: "#84cc16",
  maroon: "#7f1d1d",
  gold: "#d4a017",
  silver: "#a8a8a8",
  charcoal: "#333333",
  indigo: "#4b0082",
}

export function resolveColorHex(colorInput: string): string {
  if (!colorInput) return "#171717"
  const trimmed = colorInput.trim()
  if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) {
    return trimmed
  }
  const normalized = trimmed.toLowerCase()
  return COLOR_SWATCH_MAP[normalized] ?? "#171717"
}

export async function listPublishedProducts(
  options: { collectionId?: string; excludeProductId?: string; take?: number; ids?: string[] } = {},
) {
  const prisma = getPrisma()
  const found = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      ...(options.ids ? { id: { in: options.ids } } : {}),
      ...(options.collectionId
        ? { collections: { some: { collectionId: options.collectionId } } }
        : {}),
      ...(options.excludeProductId ? { id: { not: options.excludeProductId } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options.take,
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      tags: true,
      pageContent: true,
      category: {
        select: {
          name: true,
          slug: true,
        },
      },
      variants: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          price: true,
          compareAtPrice: true,
          inventoryQuantity: true,
          optionValues: true,
        },
      },
      images: {
        orderBy: { position: "asc" },
        take: 12,
        select: {
          objectKey: true,
          altText: true,
        },
      },
    },
  })

  // Hand-picked lists keep the order they were picked in.
  const products = options.ids
    ? options.ids.flatMap((id) => found.filter((product) => product.id === id))
    : found

  return products.map((product) => {
    const content = parseProductPageContent(product.pageContent)
    const variant = product.variants[0]
    
    const sizes = Array.from(new Set(
      product.variants.flatMap(v => {
        const opts = variantOptionValues(v.optionValues)
        const size = opts["Size"] || opts["size"]
        if (typeof size === "string" && size.trim()) {
          return [size.trim().toUpperCase()]
        }
        return []
      })
    ))
    
    const swatches = Array.from(new Set(
      product.variants.flatMap(v => {
        const opts = variantOptionValues(v.optionValues)
        const colorOpt = opts["Color"] || opts["color"]
        if (!colorOpt) return []
        if (typeof colorOpt === "object" && colorOpt !== null && "value" in colorOpt) {
          return [resolveColorHex(String(colorOpt.value))]
        }
        if (typeof colorOpt === "string") {
          return colorOpt.split(",").map(c => resolveColorHex(c.trim())).filter(Boolean)
        }
        return []
      })
    ))
    
    // Card gallery: lifestyle shots are left out; a chosen hover image comes second.
    const cardImages = product.images.filter(
      (img) => content.imageRoles[img.objectKey] !== "lifestyle" && img.objectKey !== content.hoverImageKey,
    )
    const hover = product.images.find((img) => img.objectKey === content.hoverImageKey)
    const ordered = (cardImages.length > 0 ? cardImages : product.images).slice(0, 5)
    if (hover) ordered.splice(1, 0, hover)
    const image = ordered[0]
    const gallery = ordered.map(img => imageUrl(img.objectKey)).filter((url): url is string => url !== null)

    const badge = content.badge || product.tags.find(t => 
      ["NEW ARRIVAL", "BESTSELLER", "SALE", "HOT", "TRENDING", "LIMITED"].includes(t.toUpperCase())
    )?.toUpperCase() || (product.tags.length > 0 ? product.tags[0].toUpperCase() : undefined)

    return {
      id: product.id,
      title: product.title,
      slug: product.slug,
      description: product.description,
      category: product.category,
      /** Line / short name for card labels (falls back to the category). */
      lineName: content.shortName || null,
      price: variant ? `₹${variant.price.toString()}` : "N/A",
      compareAtPrice: variant?.compareAtPrice ? `₹${variant.compareAtPrice.toString()}` : null,
      isInStock: product.variants.some(v => v.inventoryQuantity > 0),
      image: image ? (imageUrl(image.objectKey) ?? "") : (gallery[0] ?? ""),
      alt: image?.altText || product.title,
      gallery: gallery.length > 0 ? gallery : (image ? [imageUrl(image.objectKey) ?? ""] : []),
      sizes: sizes.length > 0 ? sizes : ["28", "32", "36", "42"],
      swatches: swatches.length > 0 ? swatches : ["#171717"],
      badge,
    }
  })
}

export async function listProductsForAdmin(): Promise<AdminProductListItem[]> {
  await requirePermission("products.view")

  const prisma = getPrisma()
  const products = await prisma.product.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      tags: true,
      vendor: true,
      updatedAt: true,
      category: {
        select: {
          name: true,
        },
      },
      variants: {
        orderBy: { createdAt: "asc" },
        select: {
          sku: true,
          price: true,
          inventoryQuantity: true,
        },
      },
      collections: {
        orderBy: { position: "asc" },
        select: {
          collection: { select: { title: true } },
        },
      },
      images: {
        orderBy: { position: "asc" },
        take: 1,
        select: {
          objectKey: true,
          altText: true,
        },
      },
    },
  })

  return products.map((product) => {
    const totalInventory = product.variants.reduce(
      (total, variant) => total + variant.inventoryQuantity,
      0,
    )
    const image = product.images[0]

    return {
      id: product.id,
      title: product.title,
      slug: product.slug,
      status: product.status,
      categoryName: product.category?.name ?? "Uncategorized",
      collectionNames: product.collections.map(({ collection }) => collection.title),
      tags: product.tags,
      vendor: product.vendor,
      sku: product.variants[0]?.sku ?? null,
      variantCount: product.variants.length,
      totalInventory,
      minimumPrice:
        product.variants
          .map((variant) => variant.price)
          .sort((a, b) => a.comparedTo(b))[0]
          ?.toString() ?? null,
      image: image
        ? {
            url: imageUrl(image.objectKey),
            altText: image.altText,
          }
        : null,
      updatedAt: product.updatedAt.toISOString(),
    }
  })
}

function productDetails(value: unknown): { name: string; value: string }[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((detail) => {
    if (!detail || typeof detail !== "object") {
      return []
    }

    const { name, value: detailValue } = detail as {
      name?: unknown
      value?: unknown
    }
    return typeof name === "string" && typeof detailValue === "string"
      ? [{ name, value: detailValue }]
      : []
  })
}

function variantOptionValues(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, optionValue]) => typeof key === "string"
    ),
  )
}

export async function getProductForAdmin(
  productId: string,
): Promise<AdminProductDetail | null> {
  await requirePermission("products.view")
  const prisma = getPrisma()
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      status: true,
      vendor: true,
      tags: true,
      details: true,
      pageContent: true,
      taxRate: true,
      hsnCode: true,
      isTaxExempt: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { id: true, name: true } },
      collections: {
        orderBy: { position: "asc" },
        select: { collection: { select: { id: true, title: true } } },
      },
      images: {
        orderBy: { position: "asc" },
        select: { id: true, objectKey: true, altText: true },
      },
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
    },
  })

  if (!product) {
    return null
  }

  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    description: product.description,
    status: product.status,
    categoryId: product.category?.id ?? null,
    categoryName: product.category?.name ?? "Uncategorized",
    collectionIds: product.collections.map(({ collection }) => collection.id),
    collectionNames: product.collections.map(({ collection }) => collection.title),
    tags: product.tags,
    vendor: product.vendor,
    details: productDetails(product.details),
    pageContent: parseProductPageContent(product.pageContent),
    taxRate: product.taxRate ? Number(product.taxRate) : 18,
    hsnCode: product.hsnCode ?? "",
    isTaxExempt: product.isTaxExempt ?? false,
    images: product.images.map((image) => ({
      id: image.id,
      objectKey: image.objectKey,
      url: imageUrl(image.objectKey),
      altText: image.altText,
    })),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      price: variant.price.toString(),
      compareAtPrice: variant.compareAtPrice?.toString() ?? null,
      inventoryQuantity: variant.inventoryQuantity,
      optionValues: variantOptionValues(variant.optionValues),
    })),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  }
}

/** Units sold across orders that weren't cancelled. */
async function soldCount(productId: string) {
  try {
    const result = await getPrisma().orderItem.aggregate({
      _sum: { quantity: true },
      where: { variant: { productId }, order: { status: { not: "CANCELLED" } } },
    })
    return result._sum.quantity ?? 0
  } catch {
    return 0
  }
}

const textLines = (text: string) => text.split("\n").map((line) => line.trim()).filter(Boolean)

/**
 * Storefront product page data. `preview` (staff only, checked by the page)
 * also returns Draft products.
 */
export async function getProductBySlug(slug: string, options: { preview?: boolean } = {}) {
  const prisma = getPrisma()
  const product = await prisma.product.findUnique({
    where: options.preview ? { slug } : { slug, status: "ACTIVE" },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      description: true,
      details: true,
      pageContent: true,
      tags: true,
      category: { select: { name: true } },
      collections: {
        orderBy: { position: "asc" },
        select: { collection: { select: { id: true, title: true, slug: true, isPublished: true } } },
      },
      images: {
        orderBy: { position: "asc" },
        select: { objectKey: true, altText: true },
      },
      variants: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          price: true,
          compareAtPrice: true,
          inventoryQuantity: true,
          optionValues: true,
        },
      },
    },
  })

  if (!product) return null

  const pageContent = parseProductPageContent(product.pageContent)
  const primaryCollection = product.collections[0]?.collection ?? null
  const [moreFromProducts, offers, siteContent, sold, completeLookProducts] = await Promise.all([
    primaryCollection
      ? listPublishedProducts({
          collectionId: primaryCollection.id,
          excludeProductId: product.id,
          take: 8,
        })
      : Promise.resolve([]),
    listStorefrontOffers(3, pageContent.offerCodes),
    getSiteContent(),
    pageContent.showSoldCount ? soldCount(product.id) : Promise.resolve(0),
    pageContent.completeLookIds.length > 0
      ? listPublishedProducts({ ids: pageContent.completeLookIds })
      : Promise.resolve([]),
  ])
  const shared = siteContent.productPage

  const detailsList = productDetails(product.details)
  const detailsBody = detailsList.find(d => d.name.toUpperCase() === "BODY")?.value || product.description || ""

  const sizes = Array.from(new Set(
    product.variants.flatMap(v => {
      const opts = variantOptionValues(v.optionValues)
      const size = opts["Size"] || opts["size"]
      if (typeof size === "string" && size.trim()) {
        return [size.trim().toUpperCase()]
      }
      return []
    })
  ))

  const colorMap = new Map<string, string>()
  product.variants.forEach(v => {
    const opts = variantOptionValues(v.optionValues)
    const colorOpt = opts["Color"] || opts["color"]
    if (colorOpt) {
      if (typeof colorOpt === "object" && colorOpt !== null) {
        const name = colorOpt.name || colorOpt.label || "Color"
        const value = resolveColorHex(colorOpt.value || colorOpt.hex || name)
        colorMap.set(name, value)
      } else if (typeof colorOpt === "string") {
        const parts = colorOpt.split(",")
        for (const part of parts) {
          const colorName = part.trim()
          if (colorName) {
            colorMap.set(colorName, resolveColorHex(colorName))
          }
        }
      }
    }
  })
  const colors = Array.from(colorMap.entries()).map(([name, value]) => ({ name, value }))

  if (colors.length === 0) {
    colors.push({ name: pageContent.colourName || "Default", value: "#171717" })
  }

  // Main gallery: hover-only and lifestyle shots are left out (they have their own places).
  const roleOf = (key: string) => pageContent.imageRoles[key] ?? "gallery"
  const galleryImages = product.images.filter(
    (img) => roleOf(img.objectKey) !== "hover" && roleOf(img.objectKey) !== "lifestyle",
  )
  const gallery = (galleryImages.length > 0 ? galleryImages : product.images).map(img => ({
    src: imageUrl(img.objectKey) ?? "",
    alt: img.altText ?? product.title,
    objectPosition: "center 36%"
  })).filter(img => img.src)

  const variant = product.variants[0]

  // Care: the admin checklist first; older products fall back to a "Care" detail.
  const careDetail = detailsList.find(d => /care|wash/i.test(d.name))
  const careNotes = pageContent.care.length > 0
    ? pageContent.care
    : careDetail
      ? careDetail.value.split(/\n|;/).map(s => s.trim()).filter(Boolean)
      : []

  // "Shipping, Returns & Exchanges": shared text unless this product overrides it.
  const shippingSections = pageContent.shippingOverride
    ? [{ title: "", lines: textLines(pageContent.shippingOverride) }]
    : ([
        ["Shipping", shared.shipping],
        ["Returns", shared.returns],
        ["Exchanges", shared.exchanges],
        ["Refunds", shared.refunds],
      ] as const)
        .map(([title, text]) => ({ title, lines: textLines(text) }))
        .filter((section) => section.lines.length > 0)

  // FEATURES list, in the Figma order.
  const specValue = (key: (typeof SPEC_FIELDS)[number]["key"]) => pageContent.specs[key]?.trim() || ""
  const features = [
    { label: "Product", value: pageContent.shortName },
    { label: "Article Code", value: pageContent.articleCode },
    { label: "Edit", value: pageContent.edit },
    { label: "Category", value: product.category?.name ?? "" },
    ...SPEC_FIELDS.filter((f) => f.key !== "countryOfOrigin").map((f) => ({ label: f.label, value: specValue(f.key) })),
    { label: "Colour", value: pageContent.colourName },
    { label: "Country of Origin", value: specValue("countryOfOrigin") },
  ].filter((feature) => feature.value)
  // Only identity fields filled in isn't a feature list yet.
  const hasSpecs = SPEC_FIELDS.some((f) => specValue(f.key))

  const genderLabel = pageContent.gender === "MEN" ? "Men" : pageContent.gender === "WOMEN" ? "Women" : null
  const fitSpec = specValue("fit").toLowerCase()
  const fitType =
    pageContent.sizeChart ||
    (fitSpec.includes("bootcut") ? "bootcut" : fitSpec.includes("straight") ? "straight" : "regular")

  const badges = pageContent.hideReturnBadges
    ? []
    : [
        { label: shared.returnsBadge, detail: "", icon: "returns" as const },
        { label: shared.exchangesBadge, detail: "", icon: "exchange" as const },
      ].filter((badge) => badge.label.trim())

  return {
    id: product.id,
    slug: product.slug,
    isDraft: product.status !== "ACTIVE",
    editLabel: (pageContent.shortName || product.category?.name || "Pubesto").toUpperCase(),
    title: product.title,
    seoTitle: pageContent.seoTitle,
    seoDescription: pageContent.seoDescription,
    breadcrumb: [
      { label: "Homepage", href: "/" },
      ...(genderLabel ? [{ label: genderLabel, href: pageContent.gender === "MEN" ? "/shop" : undefined }] : [
        { label: "Collections", href: "/collections" },
      ]),
      ...(product.category?.name ? [{ label: product.category.name }] : []),
      { label: product.title },
    ],
    originalPrice: variant?.compareAtPrice ? `₹${variant.compareAtPrice.toString()}` : null,
    price: variant ? `₹${variant.price.toString()}` : "N/A",
    // Real units sold, only when switched on for the product. Ratings need a reviews system first.
    sold: pageContent.showSoldCount && sold > 0 ? `${sold.toLocaleString("en-IN")} Sold` : undefined,
    description: product.description || "",
    subtitle: pageContent.subtitle,
    modelInfo: modelLine(pageContent),
    fitNote: pageContent.fitNote,
    fitHeadline: pageContent.fitHeadline,
    fitText: pageContent.fitText,
    features: hasSpecs ? features : [],
    highlightStrip:
      shared.showHighlightStrip && !pageContent.hideHighlightStrip
        ? pageContent.highlightStrip.filter((tile) => tile.title || tile.text)
        : [],
    bundleLine: pageContent.bundleLine,
    origin: pageContent.originOverride || shared.origin,
    shippingSections,
    highlightsIntro: pageContent.highlightsIntro,
    highlights: pageContent.highlights.flatMap((highlight) => {
      const src = highlight.imageKey ? imageUrl(highlight.imageKey) : null
      return src ? [{ src, title: highlight.title, text: highlight.text }] : []
    }),
    lifestyleImage: pageContent.lifestyleImageKey
      ? imageUrl(pageContent.lifestyleImageKey)
      : null,
    moreFrom: primaryCollection && moreFromProducts.length > 0
      ? {
          title: primaryCollection.title,
          href: primaryCollection.isPublished ? `/collections/${primaryCollection.slug}` : null,
          products: moreFromProducts,
        }
      : null,
    completeLookProducts,
    alsoLikeIds: pageContent.alsoLikeIds,
    offers,
    details: detailsList,
    detailsBody: detailsBody,
    careNotes,
    shippingNotes: shippingSections.flatMap((section) => section.lines),
    colorName: pageContent.colourName || colors[0]?.name || "Default",
    colors,
    sizes: sizes.length > 0 ? sizes : ["28", "32", "36", "42"],
    gallery: gallery.length > 0 ? gallery : [{ src: "/home-page-content/product-urban.png", alt: product.title }],
    deliveryPerks: badges,
    completeLook: gallery.slice(0, 3),
    fitType: fitType as "regular" | "straight" | "bootcut",
  }
}

export type AdminProductOption = { id: string; title: string; status: string }

/** Every product (any status) for the related-product pickers. */
export async function listProductOptionsForAdmin(): Promise<AdminProductOption[]> {
  await requirePermission("products.view")
  return getPrisma().product.findMany({
    orderBy: { title: "asc" },
    select: { id: true, title: true, status: true },
  })
}
