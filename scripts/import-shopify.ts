import "dotenv/config"

import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import { PrismaPg } from "@prisma/adapter-pg"

import { Prisma, PrismaClient } from "../generated/prisma/client"
import { heroSlides, products as localProducts } from "../lib/data.js"

/**
 * One-time (re-runnable) import of the Pubesto Shopify store into our own
 * database: collections, products (variants, images, highlights), customers,
 * orders, reviews and cancellation requests.
 *
 *   npm run import:shopify
 *
 * Needs DATABASE_URL, SHOPIFY_STORE_DOMAIN (or NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN)
 * and SHOPIFY_ADMIN_ACCESS_TOKEN. Product images are downloaded into
 * public/uploads/products/shopify so the site no longer depends on Shopify's CDN.
 *
 * Everything is matched on stable keys (slug, email, Shopify order id), so
 * running it again updates records instead of duplicating them. Products that
 * were edited in the dashboard after import are left alone unless --force-products.
 */

const FORCE_PRODUCTS = process.argv.includes("--force-products")
const SKIP_IMAGES = process.argv.includes("--skip-images")

const domain = (process.env.SHOPIFY_STORE_DOMAIN || process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || "")
  .replace(/^https?:\/\//, "")
  .replace(/\/.*$/, "")
  .trim()
const adminToken = (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "").trim()
const databaseUrl = process.env.DATABASE_URL

if (!domain || !adminToken || !databaseUrl) {
  console.error("Set DATABASE_URL, SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN first.")
  process.exit(1)
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl, connectionTimeoutMillis: 10_000 }),
})

const API_VERSION = "2025-01"

async function shopify<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(`https://${domain}/admin/api/${API_VERSION}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": adminToken },
      body: JSON.stringify({ query, variables }),
    })
    const json = (await response.json()) as { data?: T; errors?: unknown }
    const throttled = JSON.stringify(json.errors ?? "").includes("THROTTLED")
    if (throttled && attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt))
      continue
    }
    if (json.errors) throw new Error(JSON.stringify(json.errors).slice(0, 600))
    return json.data as T
  }
  throw new Error("Shopify request kept getting throttled")
}

async function paginate<N>(
  field: string,
  query: string,
): Promise<N[]> {
  const nodes: N[] = []
  let after: string | null = null
  do {
    const data: Record<string, { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: N[] }> =
      await shopify(query, { after })
    const connection = data[field]
    nodes.push(...connection.nodes)
    after = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null
  } while (after)
  return nodes
}

/* ───────────────────────────── helpers ───────────────────────────── */

const normalize = (value: string) =>
  String(value || "")
    .toLowerCase()
    .replace(/-imported$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

type LocalProduct = (typeof localProducts)[number] & {
  slugAliases?: string[]
  specifications?: Record<string, string>
  colors?: { name: string; hex: string; image?: string }[]
  detail?: string
}

function findLocal(handle: string, title: string): LocalProduct | undefined {
  const slug = normalize(handle)
  const name = normalize(title)
  return (localProducts as LocalProduct[]).find(
    (product) =>
      normalize(product.slug) === slug ||
      normalize(product.name) === name ||
      (product.slugAliases ?? []).map(normalize).includes(slug),
  )
}

function parseHighlights(value: string | null | undefined): string[] {
  if (!value) return []
  const clean = (line: unknown) => String(line ?? "").replace(/^[\s\-*•]+/, "").trim()
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.map(clean).filter(Boolean)
    if (parsed && typeof parsed === "object") return Object.values(parsed).flat().map(clean).filter(Boolean)
  } catch {
    // plain text metafield
  }
  return value.split(/\r?\n|[|;]/).map(clean).filter(Boolean)
}

function skuify(value: string) {
  return (
    value
      .toUpperCase()
      .replace(/[^A-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "PUB"
  )
}

const usedSkus = new Set<string>()
/** A free SKU for a newly created variant (existing variants keep theirs). */
async function uniqueSku(preferred: string) {
  let base = skuify(preferred)
  if (!/^[A-Z0-9]/.test(base)) base = `PUB-${base}`
  let candidate = base
  let n = 2
  while (
    usedSkus.has(candidate) ||
    (await prisma.productVariant.findUnique({ where: { sku: candidate }, select: { id: true } }))
  ) {
    candidate = `${base}-${n}`
    n += 1
  }
  usedSkus.add(candidate)
  return candidate
}

let variantMapCache: Map<string, string> | null = null
async function variantMap() {
  if (variantMapCache) return variantMapCache
  variantMapCache = new Map()
  const products = await prisma.product.findMany({ select: { pageContent: true } })
  for (const product of products) {
    const ids = ((product.pageContent as Record<string, unknown> | null)?.shopifyVariantIds ?? {}) as Record<string, string>
    for (const [shopifyId, variantId] of Object.entries(ids)) variantMapCache.set(shopifyId, variantId)
  }
  return variantMapCache
}

const extensionFor = (contentType: string | null, url: string) => {
  if (contentType?.includes("png")) return "png"
  if (contentType?.includes("webp")) return "webp"
  if (contentType?.includes("avif")) return "avif"
  if (contentType?.includes("gif")) return "gif"
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return "jpg"
  const match = url.split("?")[0].match(/\.(png|jpe?g|webp|avif|gif)$/i)
  return match ? match[1].toLowerCase().replace("jpeg", "jpg") : "jpg"
}

/** Downloads an image into public/uploads/... and returns its object key. */
async function downloadImage(url: string, folder: string, name: string): Promise<string | null> {
  const hash = createHash("sha1").update(url.split("?")[0]).digest("hex").slice(0, 10)
  for (const ext of ["jpg", "png", "webp", "avif", "gif"]) {
    const existing = `uploads/${folder}/${name}-${hash}.${ext}`
    if (existsSync(join(process.cwd(), "public", existing))) return existing
  }
  // --skip-images: don't download new files (the Shopify URL is kept for now).
  if (SKIP_IMAGES) return url
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const ext = extensionFor(response.headers.get("content-type"), url)
    const key = `uploads/${folder}/${name}-${hash}.${ext}`
    const target = join(process.cwd(), "public", key)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, Buffer.from(await response.arrayBuffer()))
    return key
  } catch (error) {
    console.warn(`  ! could not download ${url}: ${(error as Error).message}`)
    return null
  }
}

/** The old storefront renamed some Shopify neck-fan colors; keep the names shoppers saw. */
function storefrontColorName(color: string, handle: string) {
  if (!handle.includes("neck-fan")) return color
  const lower = color.toLowerCase()
  if (lower === "blue" || lower === "silver") return "Arctic White"
  if (lower === "black") return "Black"
  if (lower === "pink") return "Blush Pink"
  return color
}

/**
 * Which gallery photo shows a color. Shopify variants on this store carry no
 * image, so these are the same rules the old storefront used.
 */
function colorImageFromGallery(
  color: string,
  handle: string,
  galleryUrls: string[],
  keyByUrl: Map<string, string>,
  localImage?: string,
): string | undefined {
  const keyFor = (url: string | undefined) => (url ? keyByUrl.get(url.split("?")[0]) : undefined)
  const fromLocal = keyFor(localImage)
  if (fromLocal) return fromLocal

  const name = color.toLowerCase()
  const isPink = name.includes("pink") || name.includes("blush")
  const isDark = name.includes("green") || name.includes("forest") || name.includes("black")
  const isLight = name.includes("white") || name.includes("arctic") || name.includes("blue")
  const lower = galleryUrls.map((url) => url.toLowerCase())
  let index = -1
  if (isPink) index = lower.findIndex((url) => url.includes("pink") || url.includes("_21_17_"))
  else if (isDark) index = lower.findIndex((url) => url.includes("green") || url.includes("black") || url.includes("_21_49_"))
  else if (isLight) index = lower.findIndex((url) => url.includes("white") || url.includes("arctic") || url.includes("blue") || url.includes("_24_59_"))

  if (index < 0 && handle === "adjustable-bladeless-neck-fan") {
    index = isPink ? 5 : isDark ? 6 : isLight ? 7 : -1
  }
  return index >= 0 ? keyFor(galleryUrls[index]) : undefined
}

const SWATCHES: Record<string, string> = {
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
  "off-green": "#4D7C59",
}

/* ───────────────────────────── collections ───────────────────────────── */

type ShopifyCollection = {
  id: string
  title: string
  handle: string
  description: string
  image: { url: string } | null
  products: { nodes: { id: string }[] }
}

async function importCollections() {
  const collections = await paginate<ShopifyCollection>(
    "collections",
    `query($after: String) { collections(first: 50, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes { id title handle description image { url } products(first: 250, sortKey: COLLECTION_DEFAULT) { nodes { id } } }
    } }`,
  )
  const byShopifyId = new Map<string, { id: string; members: string[] }>()
  for (const collection of collections) {
    const imageKey = collection.image?.url
      ? await downloadImage(collection.image.url, "collections/shopify", collection.handle)
      : null
    const saved = await prisma.collection.upsert({
      where: { slug: collection.handle },
      create: {
        title: collection.title,
        slug: collection.handle,
        description: collection.description || null,
        isPublished: true,
        imageObjectKey: imageKey,
        imageAltText: collection.title,
      },
      update: {
        title: collection.title,
        description: collection.description || null,
        ...(imageKey ? { imageObjectKey: imageKey } : {}),
      },
      select: { id: true },
    })
    byShopifyId.set(collection.id, { id: saved.id, members: collection.products.nodes.map((node) => node.id) })
  }
  console.log(`✓ ${collections.length} collections`)
  return byShopifyId
}

/* ───────────────────────────── products ───────────────────────────── */

type Metafield = { value: string } | null
type ShopifyProduct = {
  id: string
  title: string
  handle: string
  description: string
  status: "ACTIVE" | "DRAFT" | "ARCHIVED"
  tags: string[]
  createdAt: string
  images: { nodes: { url: string; altText: string | null }[] }
  variants: {
    nodes: {
      id: string
      title: string
      sku: string | null
      price: string
      compareAtPrice: string | null
      inventoryQuantity: number | null
      inventoryPolicy: "DENY" | "CONTINUE"
      inventoryItem: { tracked: boolean } | null
      selectedOptions: { name: string; value: string }[]
      image: { url: string } | null
    }[]
  }
  keyHighlights: Metafield
  keyHighlight: Metafield
  highlights: Metafield
  productHighlights: Metafield
  keyFeatures: Metafield
  features: Metafield
  detailHighlights: Metafield
  globalHighlights: Metafield
  rating: Metafield
  reviewsCount: Metafield
  reviewsRating: Metafield
  reviewsCount2: Metafield
}

const PRODUCT_FIELDS = `
  id title handle description status tags createdAt
  images(first: 25) { nodes { url altText } }
  variants(first: 100) { nodes {
    id title sku price compareAtPrice inventoryQuantity inventoryPolicy
    inventoryItem { tracked }
    selectedOptions { name value }
    image { url }
  } }
  keyHighlights: metafield(namespace: "custom", key: "key_highlights") { value }
  keyHighlight: metafield(namespace: "custom", key: "key_highlight") { value }
  highlights: metafield(namespace: "custom", key: "highlights") { value }
  productHighlights: metafield(namespace: "custom", key: "product_highlights") { value }
  keyFeatures: metafield(namespace: "custom", key: "key_features") { value }
  features: metafield(namespace: "custom", key: "features") { value }
  detailHighlights: metafield(namespace: "details", key: "key_highlights") { value }
  globalHighlights: metafield(namespace: "global", key: "highlights") { value }
  rating: metafield(namespace: "custom", key: "rating") { value }
  reviewsCount: metafield(namespace: "custom", key: "reviews_count") { value }
  reviewsRating: metafield(namespace: "reviews", key: "rating") { value }
  reviewsCount2: metafield(namespace: "reviews", key: "rating_count") { value }
`

/** Stock for variants Shopify doesn't track (or sells when out of stock). */
const UNTRACKED_STOCK = 100

async function importProducts(collectionMap: Map<string, { id: string; members: string[] }>) {
  const products = await paginate<ShopifyProduct>(
    "products",
    `query($after: String) { products(first: 25, after: $after, sortKey: CREATED_AT) {
      pageInfo { hasNextPage endCursor }
      nodes { ${PRODUCT_FIELDS} }
    } }`,
  )

  const productIdByShopifyId = new Map<string, string>()
  let created = 0
  let updated = 0
  let skipped = 0

  for (const shopifyProduct of products) {
    const handle = shopifyProduct.handle
    const local = findLocal(handle, shopifyProduct.title)
    const existing = await prisma.product.findUnique({
      where: { slug: handle },
      select: { id: true, pageContent: true, updatedAt: true },
    })
    const existingContent = (existing?.pageContent ?? {}) as Record<string, unknown>
    const importedAt = typeof existingContent.shopifyImportedAt === "string" ? Date.parse(existingContent.shopifyImportedAt) : 0

    // Edited in the dashboard after the last import: keep the merchant's changes.
    if (existing && !FORCE_PRODUCTS && importedAt && existing.updatedAt.getTime() - importedAt > 60_000) {
      productIdByShopifyId.set(shopifyProduct.id, existing.id)
      skipped += 1
      continue
    }

    process.stdout.write(`  · ${shopifyProduct.title}\n`)

    // Images
    const imageKeys: string[] = []
    const keyByUrl = new Map<string, string>()
    for (const [index, image] of shopifyProduct.images.nodes.entries()) {
      const key = await downloadImage(image.url, "products/shopify", `${handle}-${index + 1}`)
      if (key && !imageKeys.includes(key)) {
        imageKeys.push(key)
        keyByUrl.set(image.url.split("?")[0], key)
      }
    }

    // Highlights, rating, swatches
    const metafieldHighlights = [
      shopifyProduct.keyHighlights,
      shopifyProduct.keyHighlight,
      shopifyProduct.highlights,
      shopifyProduct.productHighlights,
      shopifyProduct.keyFeatures,
      shopifyProduct.features,
      shopifyProduct.detailHighlights,
      shopifyProduct.globalHighlights,
    ]
      .map((field) => parseHighlights(field?.value))
      .find((list) => list.length > 0)
    const bulletHighlights = [...(metafieldHighlights ?? local?.highlights ?? [])]

    const realVariants = shopifyProduct.variants.nodes.filter(
      (variant) => !(shopifyProduct.variants.nodes.length === 1 && variant.title === "Default Title"),
    )

    // Only Color and Size are real variants. The Shopify store also used a
    // "Key Highlights" option purely to show bullet points; those variants are
    // folded into one (stock added up) and their values become highlights.
    const colorSwatches: Record<string, string> = {}
    const colorImages: Record<string, string> = {}
    const optionHighlights: string[] = []
    type VariantInput = {
      shopifyIds: string[]
      title: string
      preferredSku: string
      price: number
      compareAtPrice: number | null
      inventoryQuantity: number
      optionValues: Record<string, string>
    }
    const groups = new Map<string, VariantInput>()
    for (const [index, variant] of shopifyProduct.variants.nodes.entries()) {
      const optionValues: Record<string, string> = {}
      if (realVariants.length) {
        for (const option of variant.selectedOptions) {
          const name = option.name.toLowerCase()
          if (name === "title" && option.value === "Default Title") continue
          if (name === "color" || name === "colour") {
            const color = storefrontColorName(option.value, handle)
            optionValues.Color = color
            const localColor = (local?.colors as { name: string; hex: string; image?: string }[] | undefined)?.find((c) => c.name.toLowerCase() === color.toLowerCase())
            colorSwatches[color] = localColor?.hex ?? SWATCHES[color.toLowerCase()] ?? "#D1D5DB"
            const variantImage = variant.image?.url ? keyByUrl.get(variant.image.url.split("?")[0]) : undefined
            const pickedImage =
              (variantImage && variantImage !== imageKeys[0] ? variantImage : undefined) ??
              colorImageFromGallery(color, handle, shopifyProduct.images.nodes.map((image) => image.url), keyByUrl, localColor?.image)
            if (pickedImage && pickedImage !== imageKeys[0]) colorImages[color] = pickedImage
          } else if (name === "size") {
            optionValues.Size = option.value
          } else {
            for (const line of option.value.split(/\s{2,}|[|;]/).map((part) => part.trim()).filter(Boolean)) {
              if (!optionHighlights.includes(line)) optionHighlights.push(line)
            }
          }
        }
      }
      const tracked = variant.inventoryItem?.tracked ?? false
      const stock =
        !tracked || variant.inventoryPolicy === "CONTINUE"
          ? UNTRACKED_STOCK
          : Math.max(0, variant.inventoryQuantity ?? 0)
      const price = Number(variant.price)
      const compare = variant.compareAtPrice ? Number(variant.compareAtPrice) : null
      const key = `${optionValues.Color ?? ""}|${optionValues.Size ?? ""}`
      const group = groups.get(key)
      if (group) {
        group.shopifyIds.push(variant.id)
        group.inventoryQuantity = Math.min(UNTRACKED_STOCK * 10, group.inventoryQuantity + stock)
        continue
      }
      groups.set(key, {
        shopifyIds: [variant.id],
        title: Object.values(optionValues).join(" / ") || "Default",
        preferredSku: variant.sku || `PUB-${handle}${index > 0 ? `-${index + 1}` : ""}`,
        price,
        compareAtPrice: compare !== null && compare >= price ? compare : null,
        inventoryQuantity: stock,
        optionValues,
      })
    }
    const variantInputs = [...groups.values()]
    if (!metafieldHighlights && !local?.highlights?.length && optionHighlights.length) {
      bulletHighlights.push(...optionHighlights)
    }

    const details = Object.entries(local?.specifications ?? {}).map(([name, value]) => ({ name, value: String(value) }))
    const shopifyVariantIds: Record<string, string> = {}
    const pageContent = {
      ...existingContent,
      detailLine: local?.detail ?? "",
      bulletHighlights,
      rating: shopifyProduct.rating?.value ?? shopifyProduct.reviewsRating?.value ?? local?.rating ?? "",
      reviewCount: shopifyProduct.reviewsCount?.value ?? shopifyProduct.reviewsCount2?.value ?? local?.reviews ?? "",
      colorSwatches,
      colorImages,
      shopifyId: shopifyProduct.id,
      shopifyImportedAt: new Date().toISOString(),
    }

    const status = shopifyProduct.status === "ACTIVE" ? "ACTIVE" : shopifyProduct.status === "ARCHIVED" ? "ARCHIVED" : "DRAFT"

    const productId = await prisma.$transaction(async (tx) => {
      const product = existing
        ? await tx.product.update({
            where: { id: existing.id },
            data: {
              title: shopifyProduct.title,
              description: shopifyProduct.description || null,
              status,
              tags: shopifyProduct.tags,
              details: details.length ? details : Prisma.JsonNull,
            },
            select: { id: true },
          })
        : await tx.product.create({
            data: {
              title: shopifyProduct.title,
              slug: handle,
              description: shopifyProduct.description || null,
              vendor: "Pubesto",
              status,
              tags: shopifyProduct.tags,
              details: details.length ? details : Prisma.JsonNull,
              taxRate: new Prisma.Decimal(18),
              createdAt: new Date(shopifyProduct.createdAt),
            },
            select: { id: true },
          })

      // Images: replace with the downloaded set (same keys on re-runs).
      await tx.productImage.deleteMany({ where: { productId: product.id, objectKey: { notIn: imageKeys } } })
      for (const [position, objectKey] of imageKeys.entries()) {
        await tx.productImage.upsert({
          where: { objectKey },
          create: { productId: product.id, objectKey, position, altText: shopifyProduct.title },
          update: { position, productId: product.id },
        })
      }
      return product.id
    })

    // Variants: match by Shopify id (stored in pageContent.shopifyVariantIds).
    const knownIds = (existingContent.shopifyVariantIds ?? {}) as Record<string, string>
    const keepIds: string[] = []
    for (const [index, variant] of variantInputs.entries()) {
      const knownId = variant.shopifyIds.map((id) => knownIds[id]).find(Boolean)
      const knownVariant = knownId
        ? await prisma.productVariant.findUnique({ where: { id: knownId }, select: { id: true, sku: true } })
        : null
      const data = {
        title: variant.title,
        price: new Prisma.Decimal(variant.price.toFixed(2)),
        compareAtPrice: variant.compareAtPrice === null ? null : new Prisma.Decimal(variant.compareAtPrice.toFixed(2)),
        inventoryQuantity: variant.inventoryQuantity,
        optionValues: Object.keys(variant.optionValues).length ? variant.optionValues : Prisma.JsonNull,
      }
      const saved = knownVariant
        ? await prisma.productVariant.update({ where: { id: knownVariant.id }, data, select: { id: true } })
        : await prisma.productVariant.create({
            data: {
              ...data,
              productId,
              sku: await uniqueSku(variant.preferredSku),
              // Preserve Shopify's variant order.
              createdAt: new Date(Date.parse(shopifyProduct.createdAt) + index * 1000),
            },
            select: { id: true },
          })
      for (const shopifyId of variant.shopifyIds) shopifyVariantIds[shopifyId] = saved.id
      keepIds.push(saved.id)
    }
    await prisma.productVariant.deleteMany({ where: { productId, id: { notIn: keepIds } } })

    await prisma.product.update({
      where: { id: productId },
      data: { pageContent: { ...pageContent, shopifyVariantIds } },
    })
    variantMapCache = null
    productIdByShopifyId.set(shopifyProduct.id, productId)
    if (existing) updated += 1
    else created += 1
  }

  // Collection membership in Shopify's order.
  for (const { id: collectionId, members } of collectionMap.values()) {
    const rows = members
      .map((shopifyId, position) => ({ productId: productIdByShopifyId.get(shopifyId), position }))
      .filter((row): row is { productId: string; position: number } => Boolean(row.productId))
    await prisma.productsOnCollections.deleteMany({ where: { collectionId } })
    if (rows.length) {
      await prisma.productsOnCollections.createMany({
        data: rows.map((row) => ({ collectionId, productId: row.productId, position: row.position })),
        skipDuplicates: true,
      })
    }
  }

  console.log(`✓ products: ${created} created, ${updated} updated, ${skipped} kept (edited in dashboard)`)
}

/* ───────────────────────────── customers ───────────────────────────── */

type ShopifyAddress = {
  id: string
  name: string | null
  firstName: string | null
  lastName: string | null
  company: string | null
  phone: string | null
  address1: string | null
  address2: string | null
  city: string | null
  province: string | null
  zip: string | null
  country: string | null
}

type ShopifyCustomer = {
  id: string
  firstName: string | null
  lastName: string | null
  displayName: string
  email: string | null
  phone: string | null
  createdAt: string
  emailMarketingConsent: { marketingState: string } | null
  defaultAddress: { id: string } | null
  addresses: ShopifyAddress[]
}

function toAddress(address: ShopifyAddress, isDefault: boolean) {
  return {
    id: address.id,
    label: address.company || "Home",
    name: address.name || [address.firstName, address.lastName].filter(Boolean).join(" "),
    phone: address.phone || "",
    line1: address.address1 || "",
    line2: address.address2 || "",
    city: address.city || "",
    state: address.province || "",
    pincode: address.zip || "",
    isDefault,
  }
}

async function importCustomers() {
  let customers: ShopifyCustomer[] = []
  try {
    customers = await paginate<ShopifyCustomer>(
      "customers",
      `query($after: String) { customers(first: 50, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id firstName lastName displayName email phone createdAt
          emailMarketingConsent { marketingState }
          defaultAddress { id }
          addresses { id name firstName lastName company phone address1 address2 city province zip country }
        }
      } }`,
    )
  } catch (error) {
    console.warn(`! customers skipped (token may lack read_customers): ${(error as Error).message.slice(0, 200)}`)
  }

  let count = 0
  for (const customer of customers) {
    if (!customer.email) continue
    const email = customer.email.trim().toLowerCase()
    const addresses = customer.addresses.map((address) => toAddress(address, address.id === customer.defaultAddress?.id))
    const name = customer.displayName || [customer.firstName, customer.lastName].filter(Boolean).join(" ") || email
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, addresses: true, phone: true } })
    if (existing) {
      const current = Array.isArray(existing.addresses) ? existing.addresses : []
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          emailVerified: true,
          ...(existing.phone ? {} : { phone: customer.phone }),
          ...(current.length ? {} : { addresses }),
        },
      })
    } else {
      await prisma.user.create({
        data: {
          email,
          name,
          phone: customer.phone,
          addresses,
          // Shopify already confirmed these emails (orders, receipts); lets Google sign-in link.
          emailVerified: true,
          emailMarketingSubscribed: customer.emailMarketingConsent?.marketingState === "SUBSCRIBED",
          createdAt: new Date(customer.createdAt),
        },
      })
    }
    count += 1
  }

  // Accounts from the old local (JSON) login store.
  const localFile = join(process.cwd(), "data", "customers.json")
  if (existsSync(localFile)) {
    const local = JSON.parse(readFileSync(localFile, "utf8")) as {
      name?: string
      email?: string
      phone?: string
      addresses?: Record<string, string>[]
      createdAt?: string
    }[]
    for (const customer of local) {
      if (!customer.email) continue
      const email = customer.email.trim().toLowerCase()
      const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } })
      if (exists) continue
      await prisma.user.create({
        data: {
          email,
          name: customer.name || email,
          phone: customer.phone || null,
          addresses: (customer.addresses ?? []).map((address, index) => ({ ...address, isDefault: index === 0 })),
          createdAt: customer.createdAt ? new Date(customer.createdAt) : undefined,
        },
      })
      count += 1
    }
  }
  console.log(`✓ ${count} customers`)
}

/* ───────────────────────────── orders ───────────────────────────── */

type Money = { shopMoney: { amount: string } }
type ShopifyOrder = {
  id: string
  name: string
  email: string | null
  phone: string | null
  createdAt: string
  cancelledAt: string | null
  cancelReason: string | null
  note: string | null
  displayFinancialStatus: string | null
  displayFulfillmentStatus: string
  paymentGatewayNames: string[]
  discountCodes: string[]
  subtotalPriceSet: Money
  totalDiscountsSet: Money
  totalShippingPriceSet: Money
  totalTaxSet: Money
  totalPriceSet: Money
  shippingLine: { title: string } | null
  customer: { email: string | null } | null
  shippingAddress: (ShopifyAddress & { name: string | null }) | null
  lineItems: {
    nodes: {
      title: string
      variantTitle: string | null
      sku: string | null
      quantity: number
      originalUnitPriceSet: Money
      variant: { id: string } | null
    }[]
  }
  fulfillments: { trackingInfo: { company: string | null; number: string | null; url: string | null }[] }[]
}

const money = (value: Money | null | undefined) => Number(value?.shopMoney.amount ?? 0)

function paymentMethodFor(gateways: string[]) {
  const joined = gateways.join(" ").toLowerCase()
  if (joined.includes("cash") || joined.includes("cod")) return "COD"
  if (joined.includes("razorpay")) return "RAZORPAY"
  if (joined.includes("manual")) return "MANUAL"
  return gateways[0] || "UNKNOWN"
}

async function importOrders() {
  let orders: ShopifyOrder[] = []
  try {
    orders = await paginate<ShopifyOrder>(
      "orders",
      `query($after: String) { orders(first: 25, after: $after, sortKey: CREATED_AT) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id name email phone createdAt cancelledAt cancelReason note
          displayFinancialStatus displayFulfillmentStatus paymentGatewayNames discountCodes
          subtotalPriceSet { shopMoney { amount } }
          totalDiscountsSet { shopMoney { amount } }
          totalShippingPriceSet { shopMoney { amount } }
          totalTaxSet { shopMoney { amount } }
          totalPriceSet { shopMoney { amount } }
          shippingLine { title }
          customer { email }
          shippingAddress { id name firstName lastName company phone address1 address2 city province zip country }
          lineItems(first: 100) { nodes {
            title variantTitle sku quantity
            originalUnitPriceSet { shopMoney { amount } }
            variant { id }
          } }
          fulfillments { trackingInfo { company number url } }
        }
      } }`,
    )
  } catch (error) {
    console.warn(`! orders skipped (token may lack read_orders): ${(error as Error).message.slice(0, 200)}`)
    return
  }

  const variants = await variantMap()
  let count = 0
  for (const order of orders) {
    const email = (order.email || order.customer?.email || "").trim().toLowerCase() || "unknown@pubesto.com"
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    const financial = (order.displayFinancialStatus || "").toUpperCase()
    const paid = financial === "PAID" || financial === "PARTIALLY_REFUNDED"
    const refunded = financial === "REFUNDED"
    const fulfilled = order.displayFulfillmentStatus === "FULFILLED"
    const status = order.cancelledAt ? "CANCELLED" : fulfilled ? "FULFILLED" : paid ? "CONFIRMED" : "PENDING"
    const tracking = order.fulfillments.flatMap((fulfillment) => fulfillment.trackingInfo).find((info) => info.number)
    const address = order.shippingAddress

    const data = {
      email,
      phone: order.phone || address?.phone || null,
      userId: user?.id ?? null,
      status: status as "CANCELLED" | "FULFILLED" | "CONFIRMED" | "PENDING",
      paymentStatus: refunded ? "REFUNDED" : paid ? "PAID" : "UNPAID",
      currency: "INR",
      subtotal: new Prisma.Decimal(money(order.subtotalPriceSet)),
      discount: new Prisma.Decimal(money(order.totalDiscountsSet)),
      shipping: new Prisma.Decimal(money(order.totalShippingPriceSet)),
      tax: new Prisma.Decimal(money(order.totalTaxSet)),
      total: new Prisma.Decimal(money(order.totalPriceSet)),
      shippingAddress: address
        ? {
            name: address.name || [address.firstName, address.lastName].filter(Boolean).join(" "),
            address1: address.address1 || "",
            address2: address.address2 || undefined,
            city: address.city || "",
            state: address.province || "",
            postalCode: address.zip || "",
            country: address.country || "India",
            phone: address.phone || "",
          }
        : Prisma.JsonNull,
      paymentMethod: paymentMethodFor(order.paymentGatewayNames),
      shippingMethod: order.shippingLine?.title ?? null,
      discountCode: order.discountCodes[0] ?? null,
      customerNote: order.note,
      source: "SHOPIFY",
      courier: tracking?.company ?? null,
      trackingNumber: tracking?.number ?? null,
      trackingUrl: tracking?.url ?? null,
      cancelReason: order.cancelReason,
      cancelledAt: order.cancelledAt ? new Date(order.cancelledAt) : null,
      legacyName: order.name,
      createdAt: new Date(order.createdAt),
    }

    const items = order.lineItems.nodes.map((item, index) => {
      const unit = money(item.originalUnitPriceSet)
      return {
        variantId: item.variant ? variants.get(item.variant.id) ?? null : null,
        title: item.variantTitle && item.variantTitle !== "Default Title" ? `${item.title} · ${item.variantTitle}` : item.title,
        sku: item.sku || `SHOPIFY-${order.name.replace(/\D/g, "")}-${index + 1}`,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(unit),
        total: new Prisma.Decimal(unit * item.quantity),
        taxRate: new Prisma.Decimal(18),
      }
    })

    await prisma.$transaction(async (tx) => {
      const saved = await tx.order.upsert({
        where: { legacyId: order.id },
        create: { ...data, legacyId: order.id },
        update: data,
        select: { id: true },
      })
      await tx.orderItem.deleteMany({ where: { orderId: saved.id } })
      await tx.orderItem.createMany({ data: items.map((item) => ({ ...item, orderId: saved.id })) })
    })
    count += 1
  }
  console.log(`✓ ${count} orders`)
}

/* ───────────────────────── reviews, cancellations, settings ───────────────────────── */

async function importLocalData() {
  const reviewsFile = join(process.cwd(), "data", "reviews.json")
  if (existsSync(reviewsFile)) {
    const reviews = JSON.parse(readFileSync(reviewsFile, "utf8")) as Record<string, unknown>[]
    for (const review of reviews) {
      const id = String(review.id)
      const data = {
        customerName: String(review.customerName || "Customer"),
        customerImage: (review.customerImage as string) || null,
        rating: Math.min(5, Math.max(1, Math.round(Number(review.rating) || 5))),
        text: String(review.text || ""),
        productSlug: (review.productSlug as string) || null,
        productName: (review.productName as string) || null,
        showOnHomepage: Boolean(review.showOnHomepage),
        isPublished: review.isPublished !== false,
        sortOrder: Number(review.sortOrder) || 100,
        createdAt: review.createdAt ? new Date(String(review.createdAt)) : undefined,
      }
      await prisma.productReview.upsert({ where: { id }, create: { id, ...data }, update: data })
    }
    console.log(`✓ ${reviews.length} reviews`)
  }

  const cancellationsFile = join(process.cwd(), "data", "order-cancellations.json")
  if (existsSync(cancellationsFile)) {
    const rows = JSON.parse(readFileSync(cancellationsFile, "utf8")) as Record<string, unknown>[]
    for (const row of rows) {
      const ref = String(row.orderId || "").replace(/^#/, "")
      const order = await prisma.order.findFirst({ where: { legacyName: `#${ref}` }, select: { id: true } })
      const data = {
        orderRef: ref,
        orderId: order?.id ?? null,
        customerEmail: String(row.customerEmail || "").toLowerCase(),
        customerName: String(row.customerName || "Customer"),
        customerPhone: String(row.customerPhone || ""),
        reason: String(row.reason || "other"),
        reasonText: String(row.reasonText || ""),
        paymentMethod: String(row.paymentMethod || ""),
        status: String(row.status || "requested"),
        adminNotes: String(row.adminNotes || ""),
        timeline: (row.timeline as Prisma.InputJsonValue) ?? [],
        createdAt: row.createdAt ? new Date(String(row.createdAt)) : undefined,
      }
      const id = String(row.id)
      await prisma.orderCancellation.upsert({ where: { id }, create: { id, ...data }, update: data })
    }
    console.log(`✓ ${rows.length} cancellation requests`)
  }

  // The homepage hero slides become editable banners (Dashboard → Banners).
  if ((await prisma.banner.count({ where: { placement: "HERO" } })) === 0) {
    for (const [position, slide] of heroSlides.entries()) {
      await prisma.banner.create({
        data: {
          placement: "HERO",
          position,
          isActive: true,
          title: slide.title,
          subtitle: slide.copy ?? null,
          ctaText: slide.cta ?? "Shop now",
          ctaLink: slide.link ?? "/shop",
          desktopImageKey: slide.image,
          textAlignment: "LEFT",
          overlayOpacity: 0,
        },
      })
    }
    console.log(`✓ ${heroSlides.length} hero banners`)
  }

  await prisma.taxSetting.upsert({
    where: { id: "default" },
    // Seller details as shown in the site footer; edit them in Dashboard → Taxes & GST.
    create: {
      id: "default",
      originState: "Delhi",
      defaultGstRate: new Prisma.Decimal(18),
      defaultHsn: "",
      priceInclusive: true,
      legalName: "GO HYPE MEDIA",
      businessAddress: "D-6/1, Okhla Phase 2, New Delhi 110020",
    },
    update: {},
  })
}

async function main() {
  console.log(`Importing from ${domain} …`)
  const collections = await importCollections()
  await importProducts(collections)
  await importCustomers()
  await importOrders()
  await importLocalData()
  console.log("Done.")
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
