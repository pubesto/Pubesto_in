import "server-only"

import crypto from "crypto"
import Razorpay from "razorpay"

import { getRazorpayEnv } from "@/lib/server/env"

let razorpayClient: Razorpay | null = null

export function getRazorpayClient(): Razorpay {
  if (razorpayClient) return razorpayClient

  const env = getRazorpayEnv()
  const keyId = env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
  const keySecret = env.RAZORPAY_KEY_SECRET

  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay credentials are missing. Please ensure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set.",
    )
  }

  razorpayClient = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  })

  return razorpayClient
}

export function getRazorpayKeyId(): string {
  const env = getRazorpayEnv()
  const keyId = env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || ""
  if (!keyId) {
    throw new Error("RAZORPAY_KEY_ID is not configured.")
  }
  return keyId
}

export async function createRazorpayOrder({
  amountInRupees,
  receipt,
  notes,
}: {
  amountInRupees: number
  receipt?: string
  notes?: Record<string, string>
}) {
  const client = getRazorpayClient()
  const amountInPaise = Math.round(amountInRupees * 100)

  if (amountInPaise <= 0) {
    throw new Error("Order amount must be greater than zero.")
  }

  const order = await client.orders.create({
    amount: amountInPaise,
    currency: "INR",
    receipt: receipt || `rcpt_${Date.now()}`,
    notes: notes || {},
  })

  return {
    id: order.id,
    amount: order.amount,
    currency: order.currency,
  }
}

export function verifyPaymentSignature({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}: {
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}): boolean {
  const env = getRazorpayEnv()
  const secret = env.RAZORPAY_KEY_SECRET
  if (!secret) {
    throw new Error("RAZORPAY_KEY_SECRET is not configured.")
  }

  const generatedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex")

  const genBuf = Buffer.from(generatedSignature, "utf-8")
  const sigBuf = Buffer.from(razorpaySignature, "utf-8")

  if (genBuf.length !== sigBuf.length) {
    return false
  }

  return crypto.timingSafeEqual(genBuf, sigBuf)
}

export function verifyWebhookSignature({
  body,
  signature,
}: {
  body: string
  signature: string
}): boolean {
  const env = getRazorpayEnv()
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET
  if (!webhookSecret) {
    return false
  }

  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(body)
    .digest("hex")

  const expBuf = Buffer.from(expectedSignature, "utf-8")
  const sigBuf = Buffer.from(signature, "utf-8")

  if (expBuf.length !== sigBuf.length) {
    return false
  }

  return crypto.timingSafeEqual(expBuf, sigBuf)
}
