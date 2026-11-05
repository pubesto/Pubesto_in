import { NextRequest, NextResponse } from "next/server"

import { getPrisma } from "@/lib/server/db"
import { getRazorpayEnv } from "@/lib/server/env"
import { notifyOrderEvent } from "@/lib/server/notifications"
import { placeStorefrontOrder } from "@/lib/server/services/checkout"
import { verifyWebhookSignature } from "@/lib/server/services/razorpay"
import { checkoutInputSchema } from "@/lib/validations/checkout"

/**
 * Razorpay webhook (payment.captured / order.paid). Configure it in the
 * Razorpay dashboard with RAZORPAY_WEBHOOK_SECRET. It marks an existing order
 * paid, or creates the order from the saved checkout when the shopper paid but
 * closed the tab before the site could confirm it.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get("x-razorpay-signature")

    const env = getRazorpayEnv()
    if (!env.RAZORPAY_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 503 })
    }
    if (!signature || !verifyWebhookSignature({ body: rawBody, signature })) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 })
    }

    const payload = JSON.parse(rawBody)
    const event = payload?.event
    if (event !== "payment.captured" && event !== "order.paid") {
      return NextResponse.json({ status: "ignored" })
    }

    const paymentEntity = payload?.payload?.payment?.entity
    const orderEntity = payload?.payload?.order?.entity
    const razorpayOrderId: string | undefined = orderEntity?.id || paymentEntity?.order_id
    const razorpayPaymentId: string | null = paymentEntity?.id ?? null
    if (!razorpayOrderId) return NextResponse.json({ status: "ok" })

    const prisma = getPrisma()
    const order = await prisma.order.findUnique({
      where: { razorpayOrderId },
      select: { id: true, status: true, paymentStatus: true },
    })

    if (order) {
      if (order.paymentStatus !== "PAID") {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: "PAID",
            razorpayPaymentId,
            ...(order.status === "PENDING" ? { status: "CONFIRMED" } : {}),
          },
        })
      }
      return NextResponse.json({ status: "ok" })
    }

    const pending = await prisma.pendingCheckout.findUnique({ where: { razorpayOrderId } })
    if (!pending) return NextResponse.json({ status: "ok" })

    const placed = await placeStorefrontOrder(checkoutInputSchema.parse(pending.payload), {
      status: "CONFIRMED",
      paymentStatus: "PAID",
      paymentMethod: "RAZORPAY",
      paymentDetails: {
        razorpayOrderId,
        razorpayPaymentId: razorpayPaymentId ?? undefined,
        paidAt: new Date().toISOString(),
      },
    })
    await prisma.pendingCheckout.deleteMany({ where: { razorpayOrderId } })
    await notifyOrderEvent(placed.id, "ORDER_PLACED", { notifyAdmin: true })

    return NextResponse.json({ status: "ok" })
  } catch (error) {
    console.error("[razorpay-webhook] Error processing webhook:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}
