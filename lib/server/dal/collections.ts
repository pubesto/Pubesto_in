import "server-only"

import { requirePermission } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"
import { parseCollectionPageContent, type CollectionPageImage } from "@/lib/validations/collection"

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

export type AdminCollectionListItem = {
  id: string
  title: string
  slug: string
  description: string | null
  isPublished: boolean
  productCount: number
  image: { url: string | null; altText: string | null } | null
}

export type AdminCollectionProduct = {
  id: string
  title: string
  sku: string | null
  price: string | null
  status: "DRAFT" | "ACTIVE" | "ARCHIVED"
  image: { url: string | null; altText: string | null } | null
}

/** A page image with its preview URL, for the admin editor. */
export type AdminCollectionPageImage = CollectionPageImage & { url: string | null }

function withUrl(image: CollectionPageImage): AdminCollectionPageImage {
  return { ...image, url: imageUrl(image.objectKey) }
}

export type AdminCollectionEditor = {
  id: string
  title: string
  slug: string
  description: string | null
  isPublished: boolean
  image: { objectKey: string; url: string | null; altText: string | null } | null
  pageContent: {
    editorialImages: AdminCollectionPageImage[]
    banner: AdminCollectionPageImage | null
  }
  products: AdminCollectionProduct[]
}

function toCollectionProduct(product: {
  id: string
  title: string
  status: "DRAFT" | "ACTIVE" | "ARCHIVED"
  variants: { sku: string; price: { toString(): string } }[]
  images: { objectKey: string; altText: string | null }[]
}): AdminCollectionProduct {
  const variant = product.variants[0]
  const image = product.images[0]

  return {
    id: product.id,
    title: product.title,
    status: product.status,
    sku: variant?.sku ?? null,
    price: variant?.price.toString() ?? null,
    image: image
      ? { url: imageUrl(image.objectKey), altText: image.altText }
      : null,
  }
}

export async function listCollectionsForAdmin(): Promise<
  AdminCollectionListItem[]
> {
  await requirePermission("collections.view")
  const prisma = getPrisma()
  const collections = await prisma.collection.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      isPublished: true,
      imageObjectKey: true,
      imageAltText: true,
      _count: { select: { products: true } },
    },
  })

  return collections.map((collection) => ({
    id: collection.id,
    title: collection.title,
    slug: collection.slug,
    description: collection.description,
    isPublished: collection.isPublished,
    productCount: collection._count.products,
    image: collection.imageObjectKey
      ? {
          url: imageUrl(collection.imageObjectKey),
          altText: collection.imageAltText,
        }
      : null,
  }))
}

export async function listProductsForCollectionAssignment(): Promise<
  AdminCollectionProduct[]
> {
  await requirePermission("collections.view")
  const prisma = getPrisma()
  const products = await prisma.product.findMany({
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      status: true,
      variants: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { sku: true, price: true },
      },
      images: {
        orderBy: { position: "asc" },
        take: 1,
        select: { objectKey: true, altText: true },
      },
    },
  })

  return products.map(toCollectionProduct)
}

export async function getCollectionForAdmin(
  collectionId: string,
): Promise<AdminCollectionEditor | null> {
  await requirePermission("collections.view")
  const prisma = getPrisma()
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      isPublished: true,
      imageObjectKey: true,
      imageAltText: true,
      pageContent: true,
      products: {
        orderBy: { position: "asc" },
        select: {
          product: {
            select: {
              id: true,
              title: true,
              status: true,
              variants: {
                orderBy: { createdAt: "asc" },
                take: 1,
                select: { sku: true, price: true },
              },
              images: {
                orderBy: { position: "asc" },
                take: 1,
                select: { objectKey: true, altText: true },
              },
            },
          },
        },
      },
    },
  })

  if (!collection) {
    return null
  }

  return {
    id: collection.id,
    title: collection.title,
    slug: collection.slug,
    description: collection.description,
    isPublished: collection.isPublished,
    image: collection.imageObjectKey
      ? {
          objectKey: collection.imageObjectKey,
          url: imageUrl(collection.imageObjectKey),
          altText: collection.imageAltText,
        }
      : null,
    pageContent: (() => {
      const content = parseCollectionPageContent(collection.pageContent)
      return {
        editorialImages: content.editorialImages.map(withUrl),
        banner: content.banner ? withUrl(content.banner) : null,
      }
    })(),
    products: collection.products.map(({ product }) => toCollectionProduct(product)),
  }
}

export async function listPublishedCollections() {
  const prisma = getPrisma()
  const collections = await prisma.collection.findMany({
    where: { isPublished: true },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      imageObjectKey: true,
      imageAltText: true,
      _count: { select: { products: true } },
    },
  })

  return collections.map((collection) => ({
    id: collection.id,
    title: collection.title,
    slug: collection.slug,
    description: collection.description,
    productCount: collection._count.products,
    image: collection.imageObjectKey ? (imageUrl(collection.imageObjectKey) ?? "") : "",
    alt: collection.imageAltText || collection.title,
  }))
}

export async function getPublishedCollectionBySlug(slug: string) {
  const prisma = getPrisma()
  const collection = await prisma.collection.findUnique({
    where: { slug, isPublished: true },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      imageObjectKey: true,
      imageAltText: true,
      pageContent: true,
      products: {
        orderBy: { position: "asc" },
        select: {
          product: {
            select: {
              id: true,
              title: true,
              slug: true,
              description: true,
              status: true,
              tags: true,
              category: { select: { name: true, slug: true } },
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
                take: 5,
                select: { objectKey: true, altText: true },
              },
            },
          },
        },
      },
    },
  })

  if (!collection) return null

  const activeProducts = collection.products
    .map(({ product }) => product)
    .filter((product) => product.status === "ACTIVE")
    .map((product) => {
      const variant = product.variants[0]
      const sizes = Array.from(new Set(
        product.variants.flatMap(v => {
          const opts = (v.optionValues && typeof v.optionValues === "object" && !Array.isArray(v.optionValues))
            ? (v.optionValues as Record<string, unknown>)
            : {}
          const size = opts["Size"] || opts["size"]
          return typeof size === "string" && size.trim() ? [size.trim().toUpperCase()] : []
        })
      ))

      const swatches = Array.from(new Set(
        product.variants.flatMap(v => {
          const opts = (v.optionValues && typeof v.optionValues === "object" && !Array.isArray(v.optionValues))
            ? (v.optionValues as Record<string, unknown>)
            : {}
          const colorOpt = opts["Color"] || opts["color"]
          if (!colorOpt) return []
          if (typeof colorOpt === "object" && colorOpt !== null && "value" in colorOpt) {
            return [String(colorOpt.value)]
          }
          if (typeof colorOpt === "string") {
            return colorOpt.split(",").map(c => c.trim()).filter(Boolean)
          }
          return []
        })
      ))

      const image = product.images[0]
      const gallery = product.images.map(img => imageUrl(img.objectKey)).filter((url): url is string => url !== null)
      const badge = product.tags.find(t => 
        ["NEW ARRIVAL", "BESTSELLER", "SALE", "HOT", "TRENDING", "LIMITED"].includes(t.toUpperCase())
      )?.toUpperCase() || (product.tags.length > 0 ? product.tags[0].toUpperCase() : undefined)

      return {
        id: product.id,
        title: product.title,
        slug: product.slug,
        description: product.description,
        category: product.category,
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

  return {
    id: collection.id,
    title: collection.title,
    slug: collection.slug,
    description: collection.description,
    image: collection.imageObjectKey ? (imageUrl(collection.imageObjectKey) ?? "") : "",
    alt: collection.imageAltText || collection.title,
    products: activeProducts,
    // Admin-chosen page images; empty / null means the page picks them automatically.
    ...(() => {
      const content = parseCollectionPageContent(collection.pageContent)
      const toImage = (image: CollectionPageImage) => ({
        src: imageUrl(image.objectKey) ?? "",
        alt: image.alt || collection.title,
        href: image.href || undefined,
      })
      return {
        editorialImages: content.editorialImages.map(toImage).filter((image) => image.src),
        banner: content.banner ? toImage(content.banner) : null,
      }
    })(),
  }
}

export type PublishedCollectionWithImages = {
  id: string
  title: string
  slug: string
  description: string | null
  productCount: number
  image: string
  alt: string
  images: { src: string; alt: string }[]
}

/**
 * Published collections with up to `maxImages` image URLs each: the collection
 * image first, then the first image of each active product (falling back to
 * secondary product images when there are too few products).
 */
export async function listPublishedCollectionsWithImages(
  maxImages = 5,
): Promise<PublishedCollectionWithImages[]> {
  const prisma = getPrisma()
  const collections = await prisma.collection.findMany({
    where: { isPublished: true },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      imageObjectKey: true,
      imageAltText: true,
      _count: {
        select: { products: { where: { product: { status: "ACTIVE" } } } },
      },
      products: {
        where: { product: { status: "ACTIVE" } },
        orderBy: { position: "asc" },
        take: 12,
        select: {
          product: {
            select: {
              title: true,
              images: {
                orderBy: { position: "asc" },
                take: 2,
                select: { objectKey: true, altText: true },
              },
            },
          },
        },
      },
    },
  })

  return collections.map((collection) => {
    const image = collection.imageObjectKey
      ? (imageUrl(collection.imageObjectKey) ?? "")
      : ""
    const alt = collection.imageAltText || collection.title
    const images: { src: string; alt: string }[] = []
    const seen = new Set<string>()
    const add = (src: string | null, imageAlt: string) => {
      if (!src || seen.has(src) || images.length >= maxImages) return
      seen.add(src)
      images.push({ src, alt: imageAlt })
    }

    add(image || null, alt)
    const products = collection.products.map(({ product }) => product)
    for (const product of products) {
      const first = product.images[0]
      if (first) add(imageUrl(first.objectKey), first.altText || product.title)
    }
    for (const product of products) {
      const second = product.images[1]
      if (second) add(imageUrl(second.objectKey), second.altText || product.title)
    }

    return {
      id: collection.id,
      title: collection.title,
      slug: collection.slug,
      description: collection.description,
      productCount: collection._count.products,
      image: image || images[0]?.src || "",
      alt,
      images,
    }
  })
}
