import "server-only"

import { getPrisma } from "@/lib/server/db"

export type StorefrontReview = {
  id: string
  customerName: string
  customerImage: string
  initials: string
  rating: number
  text: string
  productSlug: string
  productName: string
  showOnHomepage: boolean
  isPublished: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export function initialsOf(name: string) {
  return (
    String(name || "Customer")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "C"
  )
}

type ReviewRow = {
  id: string
  customerName: string
  customerImage: string | null
  rating: number
  text: string
  productSlug: string | null
  productName: string | null
  showOnHomepage: boolean
  isPublished: boolean
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

export function toStorefrontReview(row: ReviewRow): StorefrontReview {
  return {
    id: row.id,
    customerName: row.customerName,
    customerImage: row.customerImage ?? "",
    initials: initialsOf(row.customerName),
    rating: row.rating,
    text: row.text,
    productSlug: row.productSlug ?? "",
    productName: row.productName ?? "",
    showOnHomepage: row.showOnHomepage,
    isPublished: row.isPublished,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Published reviews for the homepage (scope "home") or one product. */
export async function listPublishedReviews({ scope, productSlug }: { scope?: string | null; productSlug?: string | null }) {
  const rows = await getPrisma().productReview.findMany({
    where: {
      isPublished: true,
      ...(scope === "home"
        ? { showOnHomepage: true }
        : productSlug
          ? { productSlug: productSlug.trim().toLowerCase() }
          : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 200,
  })
  const reviews = rows.map(toStorefrontReview)
  const count = reviews.length
  const averageRating = count
    ? Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / count) * 10) / 10
    : 0
  return { reviews, summary: { count, averageRating } }
}
