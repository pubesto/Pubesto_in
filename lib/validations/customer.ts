import { z } from "zod"

const nameSchema = z
  .string()
  .trim()
  .min(2, "Enter the customer's name.")
  .max(120, "A customer name can be at most 120 characters.")

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(254, "Enter a valid email address.")

export const customerInputSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  emailMarketingSubscribed: z.boolean().default(false),
})

export const customerImportSchema = z
  .array(customerInputSchema)
  .min(1, "The CSV needs at least one customer.")
  .max(500, "Import up to 500 customers at a time.")
  .superRefine((customers, context) => {
    const seen = new Set<string>()

    for (const [index, customer] of customers.entries()) {
      if (seen.has(customer.email)) {
        context.addIssue({
          code: "custom",
          path: [index, "email"],
          message: "Each email address can only appear once in an import.",
        })
      }
      seen.add(customer.email)
    }
  })

export type CustomerInput = z.infer<typeof customerInputSchema>
export type CustomerImport = z.infer<typeof customerImportSchema>
