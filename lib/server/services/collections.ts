import "server-only"

import { Prisma } from "@/generated/prisma/client"
import { toAdminUppercase } from "@/lib/content-case"
import { assertPermission } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"
import type { CollectionInput } from "@/lib/validations/collection"

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
  excludingCollectionId?: string,
) {
  const baseSlug = slugify(requestedSlug) || "collection"
  const matchingSlugs = await tx.collection.findMany({
    where: {
      ...(excludingCollectionId ? { id: { not: excludingCollectionId } } : {}),
      OR: [{ slug: baseSlug }, { slug: { startsWith: `${baseSlug}-` } }],
    },
    select: { slug: true },
  })
  const usedSlugs = new Set(matchingSlugs.map((collection) => collection.slug))

  if (!usedSlugs.has(baseSlug)) {
    return baseSlug
  }

  let suffix = 2
  while (usedSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix += 1
  }

  return `${baseSlug}-${suffix}`
}

async function validateProductIds(
  tx: Prisma.TransactionClient,
  productIds: string[],
) {
  if (productIds.length === 0) {
    return
  }

  const count = await tx.product.count({ where: { id: { in: productIds } } })
  if (count !== productIds.length) {
    throw new Error("One or more selected products no longer exist.")
  }
}

function collectionData(input: CollectionInput, slug: string) {
  return {
    title: toAdminUppercase(input.title),
    slug,
    description: input.description ? toAdminUppercase(input.description) : null,
    isPublished: input.isPublished,
    imageObjectKey: input.imageObjectKey || null,
    imageAltText: input.imageObjectKey && input.imageAltText
      ? toAdminUppercase(input.imageAltText)
      : null,
    pageContent: input.pageContent,
  }
}

export async function createCollection(input: CollectionInput) {
  await assertPermission("collections.manage")
  const prisma = getPrisma()

  return prisma.$transaction(async (tx) => {
    const [slug] = await Promise.all([
      createAvailableSlug(tx, input.slug || input.title),
      validateProductIds(tx, input.productIds),
    ])

    return tx.collection.create({
      data: {
        ...collectionData(input, slug),
        products: input.productIds.length
          ? {
              create: input.productIds.map((productId, position) => ({
                productId,
                position,
              })),
            }
          : undefined,
      },
      select: { id: true, slug: true },
    })
  })
}

export async function updateCollection(
  collectionId: string,
  input: CollectionInput,
) {
  await assertPermission("collections.manage")
  const prisma = getPrisma()

  return prisma.$transaction(async (tx) => {
    const existing = await tx.collection.findUnique({
      where: { id: collectionId },
      select: { id: true },
    })

    if (!existing) {
      throw new Error("Collection not found.")
    }

    const [slug] = await Promise.all([
      createAvailableSlug(tx, input.slug || input.title, collectionId),
      validateProductIds(tx, input.productIds),
    ])

    return tx.collection.update({
      where: { id: collectionId },
      data: {
        ...collectionData(input, slug),
        products: {
          deleteMany: {},
          create: input.productIds.map((productId, position) => ({
            productId,
            position,
          })),
        },
      },
      select: { id: true, slug: true },
    })
  })
}

export async function updateCollectionPublished(
  collectionId: string,
  isPublished: boolean,
) {
  await assertPermission("collections.manage")
  const prisma = getPrisma()

  return prisma.collection.update({
    where: { id: collectionId },
    data: { isPublished },
    select: { id: true, isPublished: true },
  })
}

export async function deleteCollections(collectionIds: string[]) {
  await assertPermission("collections.delete")
  const prisma = getPrisma()

  return prisma.collection.deleteMany({
    where: { id: { in: collectionIds } },
  })
}
