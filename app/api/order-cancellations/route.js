import { after, NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db";
import { notifyOrderEvent } from "@/lib/server/notifications";
import { findOrderByReference, orderReference } from "@/lib/server/storefront/account";
import { cancelOrdersWithoutPermissionCheck } from "@/lib/server/services/orders";

export const dynamic = "force-dynamic";

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function validate(body) {
  if (!String(body.orderId || "").trim()) return "Order ID is required.";
  if (!isValidEmail(body.customerEmail)) return "Please enter a valid email address.";
  if (!String(body.customerName || "").trim()) return "Customer name is required.";
  if (!String(body.reason || "").trim()) return "Cancellation reason is required.";
  return null;
}

function newId() {
  return `CAN-${Math.floor(100000 + Math.random() * 900000)}`;
}

/** Public view of a request: status and timeline, no contact details or internal notes. */
function publicView(row) {
  return {
    id: row.id,
    orderId: row.orderRef,
    reason: row.reason,
    reasonText: row.reasonText,
    status: row.status,
    adminNotes: row.adminNotes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    timeline: row.timeline,
  };
}

export async function GET(request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Cancellation ID is required." }, { status: 400 });
    }
    const row = await getPrisma().orderCancellation.findUnique({ where: { id: id.trim().toUpperCase() } });
    if (!row) {
      return NextResponse.json({ error: "Cancellation request not found." }, { status: 404 });
    }
    return NextResponse.json(publicView(row));
  } catch (error) {
    console.error("GET /api/order-cancellations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Cancels an order that hasn't shipped yet. The email must match the order.
 * Prepaid orders are refunded by the team from the dashboard.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const problem = validate(body);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const prisma = getPrisma();
    const email = String(body.customerEmail).trim().toLowerCase();
    const order = await findOrderByReference(body.orderId);

    if (!order || order.email.toLowerCase() !== email) {
      return NextResponse.json(
        { error: "We couldn't find an order with that ID and email. Please check both and try again." },
        { status: 404 }
      );
    }

    const existing = await prisma.orderCancellation.findFirst({
      where: { orderId: order.id, customerEmail: email },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A cancellation request for this order already exists.", existingId: existing.id },
        { status: 409 }
      );
    }
    if (order.status === "CANCELLED") {
      return NextResponse.json({ error: "This order is already cancelled." }, { status: 409 });
    }
    if (order.status === "FULFILLED" || order.trackingNumber) {
      return NextResponse.json(
        { error: "This order has already been dispatched and cannot be cancelled. You can request a return after delivery." },
        { status: 403 }
      );
    }

    const reasonText = String(body.reasonText || "").trim().slice(0, 1000);
    await cancelOrdersWithoutPermissionCheck([order.id], `Customer: ${body.reason}${reasonText ? ` — ${reasonText}` : ""}`);

    const now = new Date().toISOString();
    const prepaid = order.paymentStatus === "PAID";
    const row = await prisma.orderCancellation.create({
      data: {
        id: newId(),
        orderRef: orderReference(order),
        orderId: order.id,
        customerEmail: email,
        customerName: String(body.customerName).trim().slice(0, 120),
        customerPhone: String(body.customerPhone || "").trim().slice(0, 20),
        reason: String(body.reason).trim().slice(0, 80),
        reasonText,
        paymentMethod: order.paymentMethod || "",
        status: "approved",
        timeline: [
          {
            status: "requested",
            label: "Cancellation Request Submitted",
            date: now,
            note: "Your cancellation request has been received.",
          },
          {
            status: "approved",
            label: "Order Cancelled Successfully",
            date: now,
            note: prepaid
              ? "Your order has been cancelled. Your refund will be processed to the original payment method within 5–7 business days."
              : "Your order has been cancelled.",
          },
        ],
      },
    });

    // after() keeps the function alive until the emails are sent; a bare promise is dropped on serverless.
    after(() => notifyOrderEvent(order.id, "ORDER_CANCELLED", { notifyAdmin: true }));

    return NextResponse.json(
      {
        success: true,
        cancellationId: row.id,
        request: publicView(row),
        message: "Order cancelled successfully.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/order-cancellations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
