import { z } from "zod"

const inventoryQuantitySchema = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined
    }

    return Number(value)
  },
  z
    .number({ error: "Enter an inventory quantity." })
    .finite()
    .int("Inventory must be a whole number.")
    .min(0, "Inventory cannot be negative.")
    .max(10_000_000, "Inventory cannot exceed 10,000,000."),
)

export const inventoryAdjustmentSchema = z.object({
  variantId: z.string().trim().min(1),
  onHand: inventoryQuantitySchema,
})

export const inventoryBulkAdjustmentSchema = z
  .array(inventoryAdjustmentSchema)
  .min(1, "Select at least one inventory item.")
  .max(500, "Update up to 500 inventory items at a time.")
  .superRefine((updates, context) => {
    const seen = new Set<string>()
    for (const [index, update] of updates.entries()) {
      if (seen.has(update.variantId)) {
        context.addIssue({
          code: "custom",
          path: [index, "variantId"],
          message: "Each inventory item can only be updated once.",
        })
      }
      seen.add(update.variantId)
    }
  })

export const inventoryImportSchema = z
  .array(
    z.object({
      sku: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9][A-Z0-9._-]{1,63}$/, "Enter a valid SKU."),
      onHand: inventoryQuantitySchema,
    }),
  )
  .min(1, "The CSV needs at least one inventory row.")
  .max(500, "Import up to 500 inventory rows at a time.")
  .superRefine((updates, context) => {
    const seen = new Set<string>()
    for (const [index, update] of updates.entries()) {
      if (seen.has(update.sku)) {
        context.addIssue({
          code: "custom",
          path: [index, "sku"],
          message: "Each SKU can only appear once in an import.",
        })
      }
      seen.add(update.sku)
    }
  })

export type InventoryAdjustment = z.infer<typeof inventoryAdjustmentSchema>
export type InventoryImport = z.infer<typeof inventoryImportSchema>
