"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { Prisma } from "@/generated/prisma/client"
import { assertPermission, permissionErrorMessage } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"

const imageUrlSchema = z
  .string()
  .trim()
  .max(1000, "The image URL is too long.")
  .refine((value) => !value || /^https?:\/\//i.test(value) || value.startsWith("/"), {
    message: "Use a full image URL (https://…) or a site path starting with /.",
  })

const reviewFieldsSchema = z.object({
  customerName: z.string().trim().min(2, "Enter the customer's name.").max(80, "The name must be at most 80 characters."),
  customerImage: imageUrlSchema.default(""),
  rating: z.coerce.number().int().min(1, "Rating must be between 1 and 5.").max(5, "Rating must be between 1 and 5."),
  text: z.string().trim().min(1, "Enter the review text.").max(2000, "The review must be at most 2000 characters."),
  productSlug: z.string().trim().toLowerCase().max(200).default(""),
  productName: z.string().trim().max(160).default(""),
  showOnHomepage: z.boolean().default(false),
  isPublished: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0, "Sort order can't be negative.").max(100000).default(100),
  /** The day the customer wrote it (e.g. the date of their email or Google review). Blank = keep / today. */
  reviewDate: z
    .string()
    .trim()
    .default("")
    .refine((value) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))), {
      message: "Enter a valid review date.",
    })
    .refine((value) => !value || Date.parse(value) <= Date.now(), { message: "The review date can't be in the future." }),
})

const reviewUpdateSchema = reviewFieldsSchema.extend({ id: z.string().min(1) })

const reviewIdsSchema = z.array(z.string().min(1)).min(1).max(500)

const reviewFlagsSchema = z
  .object({
    ids: reviewIdsSchema,
    isPublished: z.boolean().optional(),
    showOnHomepage: z.boolean().optional(),
  })
  .refine((value) => value.isPublished !== undefined || value.showOnHomepage !== undefined, {
    message: "Nothing to change.",
  })

const sortOrderSchema = z.object({
  id: z.string().min(1),
  sortOrder: z.coerce.number().int().min(0).max(100000),
})

function revalidateReviewPaths() {
  revalidatePath("/dashboard/reviews")
  revalidatePath("/")
  revalidatePath("/product/[slug]", "page")
}

function mutationError(error: unknown) {
  const denied = permissionErrorMessage(error)
  if (denied) return denied
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return "That review no longer exists."
  }
  return "The review could not be saved. Try again."
}

function toData(input: z.infer<typeof reviewFieldsSchema>) {
  return {
    customerName: input.customerName,
    customerImage: input.customerImage || null,
    rating: input.rating,
    text: input.text,
    productSlug: input.productSlug || null,
    productName: input.productName || null,
    showOnHomepage: input.showOnHomepage,
    isPublished: input.isPublished,
    sortOrder: input.sortOrder,
    // Noon UTC keeps the same calendar day when shown in India.
    ...(input.reviewDate ? { createdAt: new Date(`${input.reviewDate}T12:00:00Z`) } : {}),
  }
}

export async function createReviewAction(input: unknown) {
  const parsed = reviewFieldsSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false as const, message: parsed.error.issues[0]?.message ?? "Check the review details." }
  }
  try {
    await assertPermission("reviews.manage")
    const review = await getPrisma().productReview.create({ data: toData(parsed.data), select: { id: true } })
    revalidateReviewPaths()
    return { success: true as const, id: review.id }
  } catch (error) {
    return { success: false as const, message: mutationError(error) }
  }
}

export async function updateReviewAction(input: unknown) {
  const parsed = reviewUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false as const, message: parsed.error.issues[0]?.message ?? "Check the review details." }
  }
  try {
    await assertPermission("reviews.manage")
    const { id, ...fields } = parsed.data
    await getPrisma().productReview.update({ where: { id }, data: toData(fields), select: { id: true } })
    revalidateReviewPaths()
    return { success: true as const, id }
  } catch (error) {
    return { success: false as const, message: mutationError(error) }
  }
}

/** Publish / unpublish and homepage toggles, for one review or a selection. */
export async function setReviewFlagsAction(input: unknown) {
  const parsed = reviewFlagsSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false as const, message: parsed.error.issues[0]?.message ?? "Select at least one review." }
  }
  try {
    await assertPermission("reviews.manage")
    const { ids, isPublished, showOnHomepage } = parsed.data
    const data: { isPublished?: boolean; showOnHomepage?: boolean } = {}
    if (isPublished !== undefined) data.isPublished = isPublished
    if (showOnHomepage !== undefined) data.showOnHomepage = showOnHomepage
    const updated = await getPrisma().productReview.updateMany({ where: { id: { in: [...new Set(ids)] } }, data })
    if (!updated.count) return { success: false as const, message: "No selected reviews are still available." }
    revalidateReviewPaths()
    return { success: true as const, count: updated.count }
  } catch (error) {
    return { success: false as const, message: mutationError(error) }
  }
}

export async function setReviewSortOrderAction(input: unknown) {
  const parsed = sortOrderSchema.safeParse(input)
  if (!parsed.success) return { success: false as const, message: "Enter a whole number of 0 or more." }
  try {
    await assertPermission("reviews.manage")
    await getPrisma().productReview.update({
      where: { id: parsed.data.id },
      data: { sortOrder: parsed.data.sortOrder },
      select: { id: true },
    })
    revalidateReviewPaths()
    return { success: true as const }
  } catch (error) {
    return { success: false as const, message: mutationError(error) }
  }
}

export async function deleteReviewsAction(input: unknown) {
  const parsed = reviewIdsSchema.safeParse(input)
  if (!parsed.success) return { success: false as const, message: "Select at least one review." }
  try {
    await assertPermission("reviews.delete")
    const deleted = await getPrisma().productReview.deleteMany({ where: { id: { in: [...new Set(parsed.data)] } } })
    if (!deleted.count) return { success: false as const, message: "No selected reviews are still available." }
    revalidateReviewPaths()
    return { success: true as const, count: deleted.count }
  } catch (error) {
    return { success: false as const, message: mutationError(error) }
  }
}
