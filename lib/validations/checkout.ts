import { z } from "zod"

export const checkoutItemSchema = z.object({
  /** Product id, or its slug (carts saved before the move off Shopify). */
  productId: z.string().trim().min(1).max(200),
  /** Exact variant when the storefront knows it. */
  variantId: z.string().trim().max(60).optional(),
  color: z.string().trim().max(60).default(""),
  size: z.string().trim().max(32).default(""),
  quantity: z.number().int().min(1).max(50),
})

export const checkoutInputSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(254, "Enter a valid email address."),
  firstName: z.string().trim().min(1, "Enter your first name.").max(80),
  lastName: z.string().trim().max(80).default(""),
  phone: z
    .string()
    .trim()
    .min(8, "Enter a valid phone number.")
    .max(20, "Enter a valid phone number.")
    .regex(/^[+\d\s()-]+$/, "Enter a valid phone number."),
  address1: z.string().trim().min(3, "Enter your street address.").max(200),
  address2: z.string().trim().max(200).default(""),
  city: z.string().trim().min(1, "Enter your city.").max(100),
  state: z.string().trim().min(1, "Select your state.").max(100),
  postalCode: z.string().trim().min(3, "Enter your PIN code.").max(12),
  country: z.string().trim().min(1).max(60).default("India"),
  shippingMethod: z.enum(["standard", "second-day", "next-day"]).default("standard"),
  // "prepaid" (Razorpay: UPI, cards, netbanking) or "cod".
  paymentMethod: z.string().trim().min(1).max(32).default("prepaid"),
  saveAddress: z.boolean().default(true),
  promoCode: z.string().trim().toUpperCase().max(40).optional(),
  giftMessage: z.string().trim().max(500).optional(),
  newsletter: z.boolean().default(false),
  analyticsSessionId: z.string().trim().max(64).optional(),
  items: z
    .array(checkoutItemSchema)
    .min(1, "Your bag is empty.")
    .max(50, "A single order can contain up to 50 lines."),
})

export type CheckoutInput = z.infer<typeof checkoutInputSchema>
export type CheckoutItemInput = z.infer<typeof checkoutItemSchema>

export const razorpayConfirmationSchema = checkoutInputSchema.extend({
  razorpayOrderId: z.string().trim().min(1, "Razorpay Order ID is required."),
  razorpayPaymentId: z.string().trim().min(1, "Razorpay Payment ID is required."),
  razorpaySignature: z.string().trim().min(1, "Razorpay Signature is required."),
})

export type RazorpayConfirmationInput = z.infer<typeof razorpayConfirmationSchema>

export const cartSyncSchema = z
  .array(checkoutItemSchema)
  .max(50)
