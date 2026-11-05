import { z } from "zod"

export const collectionImageObjectKeySchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (key) =>
      key.startsWith("/") ||
      key.startsWith("uploads/") ||
      key.startsWith("collections/") ||
      key.startsWith("images/") ||
      key.startsWith("home-page-content/") ||
      /^(?:collections|uploads\/collections)\/\d{4}\/[0-9a-f-]{36}\.(?:avif|jpg|png|webp)$/i.test(key) ||
      /\.(?:avif|jpg|jpeg|png|webp|svg)$/i.test(key),
    "Invalid collection image key",
  )

// An empty link means "no link"; otherwise a site path or a full URL.
const collectionLinkSchema = z
  .string()
  .trim()
  .max(500)
  .refine((href) => href === "" || href.startsWith("/") || /^https?:\/\//.test(href), "Use a link like /collections/originals or https://…")
  .default("")

export const collectionPageImageSchema = z.object({
  objectKey: collectionImageObjectKeySchema,
  alt: z.string().trim().max(300).default(""),
  href: collectionLinkSchema,
})

/** Images on the collection page beyond the hero. Empty means "pick automatically". */
export const collectionPageContentSchema = z.object({
  editorialImages: z.array(collectionPageImageSchema).max(6, "Add up to 6 grid images.").default([]),
  banner: collectionPageImageSchema.nullable().default(null),
})

export type CollectionPageImage = z.infer<typeof collectionPageImageSchema>
export type CollectionPageContent = z.infer<typeof collectionPageContentSchema>

/** Reads the stored JSON, falling back to "automatic" for missing or older data. */
export function parseCollectionPageContent(value: unknown): CollectionPageContent {
  const result = collectionPageContentSchema.safeParse(value ?? {})
  return result.success ? result.data : { editorialImages: [], banner: null }
}

export const collectionInputSchema = z.object({
  title: z.string().trim().min(1, "Enter a collection title.").max(120),
  slug: z.string().trim().max(180).default(""),
  description: z.string().trim().max(2_000).default(""),
  isPublished: z.boolean().default(false),
  imageObjectKey: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? null : val),
    collectionImageObjectKeySchema.nullable().optional(),
  ),
  imageAltText: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? null : val),
    z.string().trim().max(300).nullable().optional(),
  ),
  pageContent: collectionPageContentSchema.default({ editorialImages: [], banner: null }),
  productIds: z
    .array(z.string().trim().min(1))
    .max(500, "A collection can contain at most 500 products.")
    .default([])
    .transform((ids) => [...new Set(ids)]),
})

export type CollectionInput = z.infer<typeof collectionInputSchema>
