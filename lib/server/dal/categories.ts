import "server-only"

import { getPrisma } from "@/lib/server/db"
import { requirePermission } from "@/lib/server/dal/auth"

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

export type AdminCategoryListItem = {
  id: string
  name: string
  slug: string
  status: "DRAFT" | "ACTIVE"
  visible: boolean
  parent: { id: string; name: string } | null
  productCount: number
  image: { url: string | null; altText: string | null } | null
}

export type AdminCategoryProduct = {
  id: string
  title: string
  sku: string | null
  price: string | null
  categoryName: string | null
  image: { url: string | null; altText: string | null } | null
}

export type AdminCategoryEditor = {
  id: string
  name: string
  slug: string
  description: string | null
  status: "DRAFT" | "ACTIVE"
  visible: boolean
  parentId: string | null
  image: { objectKey: string; url: string | null; altText: string | null } | null
  products: AdminCategoryProduct[]
}

export type AdminCategoryOption = {
  id: string
  name: string
}

export async function listCategoriesForAdmin(): Promise<
  AdminCategoryListItem[]
> {
  await requirePermission("categories.view")
  const prisma = getPrisma()
  const categories = await prisma.category.findMany({
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      visible: true,
      imageObjectKey: true,
      imageAltText: true,
      parent: { select: { id: true, name: true } },
      _count: { select: { products: true } },
    },
  })

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    status: category.status,
    visible: category.visible,
    parent: category.parent,
    productCount: category._count.products,
    image: category.imageObjectKey
      ? {
          url: imageUrl(category.imageObjectKey),
          altText: category.imageAltText,
        }
      : null,
  }))
}

export async function listCategoryOptionsForAdmin(
  excludingCategoryId?: string,
): Promise<AdminCategoryOption[]> {
  await requirePermission("categories.view")
  const prisma = getPrisma()

  return prisma.category.findMany({
    where: excludingCategoryId ? { id: { not: excludingCategoryId } } : {},
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })
}

export async function listProductsForCategoryAssignment(): Promise<
  AdminCategoryProduct[]
> {
  await requirePermission("categories.view")
  const prisma = getPrisma()
  const products = await prisma.product.findMany({
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      category: { select: { name: true } },
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

  return products.map((product) => {
    const variant = product.variants[0]
    const image = product.images[0]

    return {
      id: product.id,
      title: product.title,
      sku: variant?.sku ?? null,
      price: variant?.price.toString() ?? null,
      categoryName: product.category?.name ?? null,
      image: image
        ? { url: imageUrl(image.objectKey), altText: image.altText }
        : null,
    }
  })
}

export async function getCategoryForAdmin(
  categoryId: string,
): Promise<AdminCategoryEditor | null> {
  await requirePermission("categories.view")
  const prisma = getPrisma()
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      status: true,
      visible: true,
      parentId: true,
      imageObjectKey: true,
      imageAltText: true,
      products: {
        orderBy: { title: "asc" },
        select: {
          id: true,
          title: true,
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
  })

  if (!category) {
    return null
  }

  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    status: category.status,
    visible: category.visible,
    parentId: category.parentId,
    image: category.imageObjectKey
      ? {
          objectKey: category.imageObjectKey,
          url: imageUrl(category.imageObjectKey),
          altText: category.imageAltText,
        }
      : null,
    products: category.products.map((product) => {
      const variant = product.variants[0]
      const image = product.images[0]

      return {
        id: product.id,
        title: product.title,
        sku: variant?.sku ?? null,
        price: variant?.price.toString() ?? null,
        categoryName: category.name,
        image: image
          ? { url: imageUrl(image.objectKey), altText: image.altText }
          : null,
      }
    }),
  }
}
