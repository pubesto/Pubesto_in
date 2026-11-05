import "server-only"

import { requirePermission } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"

export type AdminReviewListItem = {
  id: string
  customerName: string
  customerImage: string
  rating: number
  text: string
  productSlug: string
  productName: string
  showOnHomepage: boolean
  isPublished: boolean
  sortOrder: number
  customerEmail: string | null
  createdAt: string
  updatedAt: string
}

export type AdminReviewProductOption = { slug: string; title: string }

export async function listReviewsForAdmin(): Promise<AdminReviewListItem[]> {
  await requirePermission("reviews.view")
  const rows = await getPrisma().productReview.findMany({
    // Unpublished (awaiting approval) first, then newest.
    orderBy: [{ isPublished: "asc" }, { createdAt: "desc" }],
    take: 1000,
    include: { user: { select: { email: true } } },
  })

  return rows.map((row) => ({
    id: row.id,
    customerName: row.customerName,
    customerImage: row.customerImage ?? "",
    rating: row.rating,
    text: row.text,
    productSlug: row.productSlug ?? "",
    productName: row.productName ?? "",
    showOnHomepage: row.showOnHomepage,
    isPublished: row.isPublished,
    sortOrder: row.sortOrder,
    customerEmail: row.user?.email ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }))
}

export async function listReviewProductOptionsForAdmin(): Promise<AdminReviewProductOption[]> {
  await requirePermission("reviews.view")
  return getPrisma().product.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { title: "asc" },
    select: { slug: true, title: true },
  })
}
