import { z } from "zod"

import { productPageContentSchema } from "@/lib/product-page-content"

export const productImageObjectKeySchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (key) =>
      key.startsWith("/") ||
      key.startsWith("uploads/") ||
      key.startsWith("products/") ||
      key.startsWith("images/") ||
      key.startsWith("home-page-content/") ||
      /^(?:products|uploads\/products)\/\d{4}\/[0-9a-f-]{36}\.(?:avif|jpg|png|webp)$/i.test(key) ||
      /\.(?:avif|jpg|jpeg|png|webp|svg)$/i.test(key),
    "Invalid product image key",
  )

const optionalMoneySchema = z
  .preprocess(
    (value) => {
      if (value === null || value === undefined || value === "") {
        return null
      }

      return Number(value)
    },
    z.number().finite().nonnegative().max(99_999_999).nullable(),
  )
  .optional()
  .transform((value) => value ?? null)

const requiredMoneySchema = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") {
      return 0
    }

    return Number(value)
  },
  z.number().finite().nonnegative().max(99_999_999).default(0),
)

const requiredQuantitySchema = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") {
      return 0
    }

    return Number(value)
  },
  z.number().int().min(0).max(10_000_000).default(0),
)

const skuSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9._-]{0,63}$/)

const optionalSkuSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  skuSchema.optional(),
)

const productVariantSchema = z
  .object({
    title: z.string().trim().min(1).max(120).default("Default"),
    sku: optionalSkuSchema,
    price: requiredMoneySchema,
    compareAtPrice: optionalMoneySchema,
    inventoryQuantity: requiredQuantitySchema,
    optionValues: z
      .record(
        z.string().min(1).max(60),
        z.any(),
      )
      .default({}),
  })
  .superRefine((value, context) => {
    if (
      value.compareAtPrice !== null &&
      value.compareAtPrice < value.price
    ) {
      context.addIssue({
        code: "custom",
        path: ["compareAtPrice"],
        message: "Compare-at price must be greater than or equal to the price.",
      })
    }
  })

export const productInputSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(180)
      .optional(),
    description: z.string().trim().max(10_000).optional(),
    status: z.enum(["DRAFT", "ACTIVE"]).default("DRAFT"),
    categoryId: z.string().trim().min(1).nullable().optional(),
    sku: optionalSkuSchema,
    price: requiredMoneySchema,
    compareAtPrice: optionalMoneySchema,
    inventoryQuantity: requiredQuantitySchema,
    variants: z.array(productVariantSchema).max(100).default([]),
    images: z.array(productImageObjectKeySchema).max(20).default([]),
    /** Alt text per image object key (optional; missing keys keep their current text). */
    imageAltTexts: z.record(z.string().max(512), z.string().trim().max(200)).optional(),
    collectionIds: z
      .array(z.string().trim().min(1))
      .max(100)
      .default([])
      .transform((ids) => [...new Set(ids)]),
    tags: z
      .array(z.string().trim().min(1).max(60))
      .max(30)
      .default([])
      .transform((tags) => [...new Set(tags)]),
    details: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(80),
          value: z.string().trim().min(1).max(2_000),
        }),
      )
      .max(30)
      .default([]),
    // Optional so callers that don't send it (e.g. bulk import) leave it untouched.
    pageContent: productPageContentSchema.optional(),
    taxRate: z.number().min(0).max(100).optional().default(18),
    hsnCode: z.string().trim().optional().default(""),
    isTaxExempt: z.boolean().optional().default(false),
  })
  .superRefine((value, context) => {
    if (
      value.compareAtPrice !== null &&
      value.compareAtPrice < value.price
    ) {
      context.addIssue({
        code: "custom",
        path: ["compareAtPrice"],
        message: "Compare-at price must be greater than or equal to the price.",
      })
    }
  })

export type ProductInput = z.infer<typeof productInputSchema>
