import { z } from "zod"

export const categoryImageObjectKeySchema = z
  .string()
  .regex(
    /^(?:categories|uploads\/categories)\/\d{4}\/[0-9a-f-]{36}\.(?:avif|jpg|png|webp)$/,
    "Invalid category image key",
  )

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a category title.").max(120),
  slug: z.string().trim().max(180).default(""),
  description: z.string().trim().max(2_000).default(""),
  status: z.enum(["DRAFT", "ACTIVE"]),
  visible: z.boolean(),
  parentId: z.string().trim().min(1).nullable().optional(),
  imageObjectKey: categoryImageObjectKeySchema.nullable().optional(),
  imageAltText: z.string().trim().max(300).nullable().optional(),
  productIds: z
    .array(z.string().trim().min(1))
    .max(500, "A category can contain at most 500 products.")
    .default([])
    .transform((ids) => [...new Set(ids)]),
})

export type CategoryInput = z.infer<typeof categoryInputSchema>
