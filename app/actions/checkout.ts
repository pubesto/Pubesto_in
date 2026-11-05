"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { z } from "zod"

import { Prisma } from "@/generated/prisma/client"
import { formatOrderReference } from "@/lib/checkout-rules"
import { getPrisma } from "@/lib/server/db"
import { notifyOrderEvent } from "@/lib/server/notifications"
import {
  calculateCheckoutSummary,
  CheckoutError,
  placeStorefrontOrder,
  verifyPromoCode,
  type CheckoutSummary,
} from "@/lib/server/services/checkout"
import {
  createRazorpayOrder,
  getRazorpayKeyId,
  verifyPaymentSignature,
} from "@/lib/server/services/razorpay"
import {
  checkoutInputSchema,
  razorpayConfirmationSchema,
} from "@/lib/validations/checkout"

export type PlaceOrderResult =
  | { success: true; orderId: string; number: number; reference: string; total: number }
  | { success: false; message: string }

export type CreateRazorpayOrderResult =
  | {
      success: true
      razorpayOrderId: string
      amount: number
      currency: string
      keyId: string
      total: number
    }
  | { success: false; message: string }

export type ValidatePromoCodeActionResult =
  | {
      success: true
      code: string
      title: string
      amount: number
      freeShipping: boolean
      discountType: string
      valueType: string
      value: number
      description: string
    }
  | { success: false; message: string }

export type CheckoutSummaryResult =
  | { success: true; summary: CheckoutSummary }
  | { success: false; message: string }

function firstError(error: z.ZodError, fallback: string) {
  const flat = z.flattenError(error)
  const firstField = Object.values(flat.fieldErrors).flat().find(Boolean)
  return flat.formErrors[0] ?? (firstField as string | undefined) ?? fallback
}

function revalidateAfterOrder(userId: string | null) {
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/orders")
  revalidatePath("/dashboard/products/inventory")
  revalidatePath("/dashboard/orders/abandoned-checkouts")
  if (userId) revalidatePath(`/dashboard/customers/${userId}`)
}

/**
 * Validates a promo code against active database discounts and returns the
 * calculated deduction for the current cart subtotal and quantity.
 */
export async function validatePromoCodeAction(
  code: string,
  subtotal: number,
  quantity: number,
): Promise<ValidatePromoCodeActionResult> {
  try {
    const result = await verifyPromoCode(code, subtotal, quantity)
    if (!result.valid) return { success: false, message: result.message }
    return {
      success: true,
      code: result.code,
      title: result.title,
      amount: result.amount,
      freeShipping: result.freeShipping,
      discountType: result.discountType,
      valueType: result.valueType,
      value: result.value,
      description: result.description,
    }
  } catch (error) {
    console.error("[checkout] validatePromoCodeAction failed", error)
    return { success: false, message: "Unable to validate coupon code. Please try again." }
  }
}

/**
 * Server-side price breakdown for the checkout page (items, discounts,
 * shipping, GST and total). The page never computes the payable amount itself.
 */
export async function getCheckoutSummaryAction(input: unknown): Promise<CheckoutSummaryResult> {
  // Address fields aren't needed for pricing; fill placeholders so the
  // summary can be shown before the form is complete.
  const base = typeof input === "object" && input ? (input as Record<string, unknown>) : {}
  const result = checkoutInputSchema.safeParse({
    email: "summary@pubesto.com",
    firstName: "Customer",
    phone: "0000000000",
    address1: "Pending",
    city: "Pending",
    postalCode: "000000",
    ...base,
    state: typeof base.state === "string" && base.state ? base.state : "Delhi",
  })
  if (!result.success) return { success: false, message: firstError(result.error, "Your cart is empty.") }
  try {
    return { success: true, summary: await calculateCheckoutSummary(result.data) }
  } catch (error) {
    if (error instanceof CheckoutError) return { success: false, message: error.message }
    console.error("[checkout] getCheckoutSummaryAction failed", error)
    return { success: false, message: "We couldn't price your cart right now. Please try again." }
  }
}

/**
 * Validates the checkout, fixes the payable amount server-side and opens a
 * Razorpay order. The checkout details are kept so the webhook can still
 * create the order if the shopper closes the tab after paying.
 */
export async function createRazorpayOrderAction(input: unknown): Promise<CreateRazorpayOrderResult> {
  const result = checkoutInputSchema.safeParse(input)
  if (!result.success) {
    return { success: false, message: firstError(result.error, "Check your shipping details and try again.") }
  }

  try {
    const data = { ...result.data, paymentMethod: "prepaid" }
    const summary = await calculateCheckoutSummary(data)
    if (summary.total <= 0) {
      return { success: false, message: "Order amount must be greater than zero." }
    }

    const keyId = getRazorpayKeyId()
    const rzpOrder = await createRazorpayOrder({
      amountInRupees: summary.total,
      receipt: `pubesto_${Date.now()}`,
      notes: {
        email: data.email,
        phone: data.phone,
        customer: `${data.firstName} ${data.lastName}`.trim(),
      },
    })

    await getPrisma().pendingCheckout.create({
      data: {
        razorpayOrderId: rzpOrder.id,
        payload: data as unknown as Prisma.InputJsonValue,
        amount: new Prisma.Decimal(summary.total),
      },
    })

    return {
      success: true,
      razorpayOrderId: rzpOrder.id,
      amount: Number(rzpOrder.amount),
      currency: rzpOrder.currency,
      keyId,
      total: summary.total,
    }
  } catch (error) {
    if (error instanceof CheckoutError) return { success: false, message: error.message }
    console.error("[checkout] createRazorpayOrderAction failed", error)
    return { success: false, message: "Unable to start the payment. Please try again." }
  }
}

/**
 * Verifies the Razorpay payment signature and places the paid order.
 * Safe to call twice: one Razorpay order only ever becomes one order.
 */
export async function confirmRazorpayOrderAction(input: unknown): Promise<PlaceOrderResult> {
  const result = razorpayConfirmationSchema.safeParse(input)
  if (!result.success) {
    return { success: false, message: firstError(result.error, "Invalid payment confirmation details.") }
  }

  try {
    const valid = verifyPaymentSignature({
      razorpayOrderId: result.data.razorpayOrderId,
      razorpayPaymentId: result.data.razorpayPaymentId,
      razorpaySignature: result.data.razorpaySignature,
    })
    if (!valid) {
      console.error("[checkout] Invalid Razorpay signature", {
        orderId: result.data.razorpayOrderId,
        paymentId: result.data.razorpayPaymentId,
      })
      return { success: false, message: "Payment verification failed. Please contact Pubesto support." }
    }

    const prisma = getPrisma()
    const pending = await prisma.pendingCheckout.findUnique({
      where: { razorpayOrderId: result.data.razorpayOrderId },
    })
    // Use the details the amount was fixed with, not whatever the browser sends now.
    const checkout = pending ? checkoutInputSchema.parse(pending.payload) : result.data

    const existing = await prisma.order.findUnique({
      where: { razorpayOrderId: result.data.razorpayOrderId },
      select: { id: true },
    })
    const order = await placeStorefrontOrder(checkout, {
      status: "CONFIRMED",
      paymentStatus: "PAID",
      paymentMethod: "RAZORPAY",
      paymentDetails: {
        razorpayOrderId: result.data.razorpayOrderId,
        razorpayPaymentId: result.data.razorpayPaymentId,
        razorpaySignature: result.data.razorpaySignature,
        paidAt: new Date().toISOString(),
      },
    })
    await prisma.pendingCheckout.deleteMany({ where: { razorpayOrderId: result.data.razorpayOrderId } })

    if (!existing) {
      after(() => notifyOrderEvent(order.id, "ORDER_PLACED", { notifyAdmin: true }))
      revalidateAfterOrder(order.userId)
    }

    return {
      success: true,
      orderId: order.id,
      number: order.number,
      reference: formatOrderReference(order.number),
      total: order.total,
    }
  } catch (error) {
    if (error instanceof CheckoutError) {
      return {
        success: false,
        message: `${error.message} Your payment is safe — our team will contact you to refund or fulfil it.`,
      }
    }
    console.error("[checkout] confirmRazorpayOrderAction failed", error)
    return { success: false, message: "We couldn't confirm your order right now. Please contact support." }
  }
}

/** Places a cash-on-delivery order. */
export async function placeOrderAction(input: unknown): Promise<PlaceOrderResult> {
  const result = checkoutInputSchema.safeParse(input)
  if (!result.success) {
    return { success: false, message: firstError(result.error, "Check your shipping details and try again.") }
  }

  try {
    const order = await placeStorefrontOrder(
      { ...result.data, paymentMethod: "cod" },
      { status: "PENDING", paymentStatus: "UNPAID", paymentMethod: "COD" },
    )

    after(() => notifyOrderEvent(order.id, "ORDER_PLACED", { notifyAdmin: true }))
    revalidateAfterOrder(order.userId)

    return {
      success: true,
      orderId: order.id,
      number: order.number,
      reference: formatOrderReference(order.number),
      total: order.total,
    }
  } catch (error) {
    if (error instanceof CheckoutError) return { success: false, message: error.message }
    console.error("[checkout] placeOrderAction failed", error)
    return { success: false, message: "We couldn't place your order right now. Please try again in a moment." }
  }
}
