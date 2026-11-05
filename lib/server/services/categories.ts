import "server-only"

import { assertPermission } from "@/lib/server/dal/auth"

import { Prisma } from "@/generated/prisma/client"
import { toAdminUppercase } from "@/lib/content-case"
import { getPrisma } from "@/lib/server/db"
import type { CategoryInput } from "@/lib/validations/category"

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180)
}

async function createAvailableSlug(
  tx: Prisma.TransactionClient,
  requestedSlug: string,
  excludingCategoryId?: string,
) {
  const baseSlug = slugify(requestedSlug) || "category"
  const matchingSlugs = await tx.category.findMany({
    where: {
      ...(excludingCategoryId ? { id: { not: excludingCategoryId } } : {}),
      OR: [{ slug: baseSlug }, { slug: { startsWith: `${baseSlug}-` } }],
    },
    select: { slug: true },
  })
  const usedSlugs = new Set(matchingSlugs.map((category) => category.slug))

  if (!usedSlugs.has(baseSlug)) {
    return baseSlug
  }

  let suffix = 2
  while (usedSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix += 1
  }

  return `${baseSlug}-${suffix}`
}

async function validateParentCategory(
  tx: Prisma.TransactionClient,
  parentId: string | null,
  categoryId?: string,
) {
  if (!parentId) {
    return
  }

  const visitedIds = new Set(categoryId ? [categoryId] : [])
  let nextParentId: string | null = parentId

  while (nextParentId) {
    if (visitedIds.has(nextParentId)) {
      throw new Error("A category cannot be its own parent or descendant.")
    }

    const parent: { id: string; parentId: string | null } | null =
      await tx.category.findUnique({
      where: { id: nextParentId },
      select: { id: true, parentId: true },
      })

    if (!parent) {
      throw new Error("The selected parent category no longer exists.")
    }

    visitedIds.add(parent.id)
    nextParentId = parent.parentId
  }
}

async function validateProductIds(
  tx: Prisma.TransactionClient,
  productIds: string[],
) {
  if (productIds.length === 0) {
    return
  }

  const count = await tx.product.count({
    where: { id: { in: productIds } },
  })

  if (count !== productIds.length) {
    throw new Error("One or more selected products no longer exist.")
  }
}

async function replaceCategoryProducts(
  tx: Prisma.TransactionClient,
  categoryId: string,
  productIds: string[],
) {
  await tx.product.updateMany({
    where:
      productIds.length > 0
        ? { categoryId, id: { notIn: productIds } }
        : { categoryId },
    data: { categoryId: null },
  })

  if (productIds.length > 0) {
    await tx.product.updateMany({
      where: { id: { in: productIds } },
      data: { categoryId },
    })
  }
}

function categoryData(input: CategoryInput, slug: string) {
  return {
    name: toAdminUppercase(input.name),
    slug,
    description: input.description ? toAdminUppercase(input.description) : null,
    status: input.status,
    visible: input.visible,
    parentId: input.parentId || null,
    imageObjectKey: input.imageObjectKey || null,
    imageAltText: input.imageObjectKey && input.imageAltText
      ? toAdminUppercase(input.imageAltText)
      : null,
  }
}

export async function createCategory(input: CategoryInput) {
  const prisma = getPrisma()

  return prisma.$transaction(async (tx) => {
    const [slug] = await Promise.all([
      createAvailableSlug(tx, input.slug || input.name),
      validateProductIds(tx, input.productIds),
      validateParentCategory(tx, input.parentId || null),
    ])
    const category = await tx.category.create({
      data: categoryData(input, slug),
      select: { id: true, slug: true },
    })

    await replaceCategoryProducts(tx, category.id, input.productIds)
    return category
  })
}

export async function updateCategory(categoryId: string, input: CategoryInput) {
  const prisma = getPrisma()

  return prisma.$transaction(async (tx) => {
    const currentCategory = await tx.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    })

    if (!currentCategory) {
      throw new Error("Category not found.")
    }

    const [slug] = await Promise.all([
      createAvailableSlug(tx, input.slug || input.name, categoryId),
      validateProductIds(tx, input.productIds),
      validateParentCategory(tx, input.parentId || null, categoryId),
    ])
    const category = await tx.category.update({
      where: { id: categoryId },
      data: categoryData(input, slug),
      select: { id: true, slug: true },
    })

    await replaceCategoryProducts(tx, category.id, input.productIds)
    return category
  })
}

export async function updateCategoryVisibility(
  categoryId: string,
  visible: boolean,
) {
  const prisma = getPrisma()

  return prisma.category.update({
    where: { id: categoryId },
    data: { visible },
    select: { id: true, visible: true },
  })
}

export async function deleteCategories(categoryIds: string[]) {
  await assertPermission("categories.delete")
  const prisma = getPrisma()

  return prisma.category.deleteMany({
    where: { id: { in: categoryIds } },
  })
}
