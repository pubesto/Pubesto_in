/**
 * Pubesto pricing rules shared by the storefront and the server. The server is
 * the source of truth: it recomputes every amount from the database and these
 * rules, never from client-submitted prices.
 */

/** Orders at or above this items total ship free. */
export const FREE_SHIPPING_THRESHOLD = 500
export const STANDARD_SHIPPING_FEE = 70

/** Extra discount for paying online (Razorpay) instead of cash on delivery. */
export const PREPAID_DISCOUNT_PERCENT = 10

export const SHIPPING_METHODS = {
  standard: { label: "Standard Shipping", price: STANDARD_SHIPPING_FEE },
  "second-day": { label: "Standard Shipping", price: STANDARD_SHIPPING_FEE },
  "next-day": { label: "Standard Shipping", price: STANDARD_SHIPPING_FEE },
} as const

export type ShippingMethodId = keyof typeof SHIPPING_METHODS

export function shippingFor(itemsTotal: number) {
  return itemsTotal >= FREE_SHIPPING_THRESHOLD
    ? { label: "Free Priority Shipping", price: 0 }
    : { label: "Standard Shipping", price: STANDARD_SHIPPING_FEE }
}

/** Online payment methods get the prepaid discount; COD does not. */
export function isPrepaidMethod(paymentMethod: string | null | undefined) {
  const method = String(paymentMethod || "").toLowerCase()
  return method !== "cod" && method !== "cash" && method !== ""
}

export function prepaidDiscountFor(itemsTotal: number, paymentMethod: string | null | undefined) {
  return isPrepaidMethod(paymentMethod) ? Math.round((itemsTotal * PREPAID_DISCOUNT_PERCENT) / 100) : 0
}

/** Kept for code copied from the Suos backend; Pubesto's automatic offer is the prepaid discount. */
export function automaticDiscountFor(subtotal: number, paymentMethod?: string | null) {
  return prepaidDiscountFor(subtotal, paymentMethod ?? "prepaid")
}

export function formatOrderReference(number: number) {
  return `PUB-${String(number).padStart(5, "0")}`
}
