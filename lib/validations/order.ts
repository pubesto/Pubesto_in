import { z } from "zod"

const orderStatusSchema = z.enum(["PENDING", "CONFIRMED"])

export const orderCreateSchema = z
  .object({
    customerId: z.string().trim().min(1).nullable().optional(),
    email: z.string().trim().toLowerCase().email("Enter a valid email address.").optional(),
    status: orderStatusSchema.default("PENDING"),
    items: z
      .array(
        z.object({
          variantId: z.string().trim().min(1),
          quantity: z.number().int().min(1).max(100),
        }),
      )
      .min(1, "Add at least one product to the order.")
      .max(100, "Add up to 100 products to an order."),
  })
  .superRefine((order, context) => {
    if (!order.customerId && !order.email) {
      context.addIssue({
        code: "custom",
        path: ["email"],
        message: "Select a customer or enter an email address.",
      })
    }

    const variantIds = new Set<string>()
    for (const [index, item] of order.items.entries()) {
      if (variantIds.has(item.variantId)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "variantId"],
          message: "Each product variant can only be added once.",
        })
      }
      variantIds.add(item.variantId)
    }
  })

export const orderIdsSchema = z
  .array(z.string().trim().min(1))
  .min(1, "Select at least one order.")
  .max(100, "Update up to 100 orders at a time.")

export type OrderCreateInput = z.infer<typeof orderCreateSchema>
