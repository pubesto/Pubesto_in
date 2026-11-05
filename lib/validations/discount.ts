import { z } from "zod"

const idListSchema = z.array(z.string().trim().min(1)).max(100)

export const discountInputSchema = z
  .object({
    title: z.string().trim().min(2, "Enter a discount title.").max(120),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{2,63}$/, "Use 3–64 letters, numbers, hyphens, or underscores.")
      .nullable()
      .optional(),
    type: z.enum(["PRODUCT", "ORDER", "BUY_X_GET_Y", "FREE_SHIPPING"]),
    method: z.enum(["CODE", "AUTOMATIC"]),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
    valueType: z.enum(["PERCENTAGE", "FIXED", "FREE"]),
    value: z.number().finite().positive().max(1_000_000).nullable().optional(),
    appliesTo: z.enum(["ALL", "PRODUCTS", "COLLECTIONS"]).default("ALL"),
    productIds: idListSchema.default([]),
    collectionIds: idListSchema.default([]),
    buyProductIds: idListSchema.default([]),
    getProductIds: idListSchema.default([]),
    minimumType: z.enum(["NONE", "AMOUNT", "QUANTITY"]).default("NONE"),
    minimumValue: z.number().finite().positive().max(1_000_000).nullable().optional(),
    usageLimit: z.number().int().positive().max(1_000_000).nullable().optional(),
    onePerCustomer: z.boolean().default(false),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().nullable().optional(),
  })
  .superRefine((discount, context) => {
    if (discount.method === "CODE" && !discount.code) {
      context.addIssue({ code: "custom", path: ["code"], message: "Enter a discount code." })
    }
    if (discount.method === "AUTOMATIC" && discount.code) {
      context.addIssue({ code: "custom", path: ["code"], message: "Automatic discounts cannot have a code." })
    }
    if (discount.type === "FREE_SHIPPING" && discount.valueType !== "FREE") {
      context.addIssue({ code: "custom", path: ["valueType"], message: "Free shipping discounts must be free." })
    }
    if (discount.type !== "FREE_SHIPPING" && discount.valueType === "FREE" && discount.type !== "BUY_X_GET_Y") {
      context.addIssue({ code: "custom", path: ["valueType"], message: "Choose a percentage or fixed amount." })
    }
    if (discount.valueType !== "FREE" && !discount.value) {
      context.addIssue({ code: "custom", path: ["value"], message: "Enter a discount value." })
    }
    if (discount.valueType === "PERCENTAGE" && (discount.value ?? 0) > 100) {
      context.addIssue({ code: "custom", path: ["value"], message: "A percentage cannot exceed 100%." })
    }
    if (discount.type === "PRODUCT" && discount.appliesTo === "PRODUCTS" && !discount.productIds.length) {
      context.addIssue({ code: "custom", path: ["productIds"], message: "Select at least one product." })
    }
    if (discount.type === "PRODUCT" && discount.appliesTo === "COLLECTIONS" && !discount.collectionIds.length) {
      context.addIssue({ code: "custom", path: ["collectionIds"], message: "Select at least one collection." })
    }
    if (discount.type === "BUY_X_GET_Y" && !discount.buyProductIds.length) {
      context.addIssue({ code: "custom", path: ["buyProductIds"], message: "Select products the customer must buy." })
    }
    if (discount.type === "BUY_X_GET_Y" && !discount.getProductIds.length) {
      context.addIssue({ code: "custom", path: ["getProductIds"], message: "Select products the customer gets." })
    }
    if (discount.minimumType !== "NONE" && !discount.minimumValue) {
      context.addIssue({ code: "custom", path: ["minimumValue"], message: "Enter a minimum purchase value." })
    }
    if (discount.minimumType === "QUANTITY" && discount.minimumValue && !Number.isInteger(discount.minimumValue)) {
      context.addIssue({ code: "custom", path: ["minimumValue"], message: "Minimum quantity must be a whole number." })
    }
    if (discount.endsAt && new Date(discount.endsAt) <= new Date(discount.startsAt)) {
      context.addIssue({ code: "custom", path: ["endsAt"], message: "The end date must be after the start date." })
    }
  })

export const discountUpdateSchema = discountInputSchema.extend({
  id: z.string().trim().min(1),
})

export const discountIdsSchema = z.array(z.string().trim().min(1)).min(1).max(100)

export const discountStatusChangeSchema = z.object({
  ids: discountIdsSchema,
  status: z.enum(["ACTIVE", "INACTIVE"]),
})

export type DiscountInput = z.infer<typeof discountInputSchema>
