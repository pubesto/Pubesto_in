import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/dal/auth";
import {
  findOrderByReference,
  listCustomerOrders,
  orderReference,
} from "@/lib/server/storefront/account";

export const dynamic = "force-dynamic";

const NOT_FOUND = { error: "Order not found. Check the order ID and the email you're logged in with." };

/** Order tracking for the signed-in customer: "PUB-00012", "#1006" or "1006". */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const reference = decodeURIComponent(id || "").trim();
    if (!reference || !/^[#A-Za-z0-9-]{1,40}$/.test(reference)) {
      return NextResponse.json({ error: "Order ID is required." }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Please log in to track your order." }, { status: 401 });
    }

    const order = await findOrderByReference(reference);
    // Same response as a missing order, so order numbers can't be probed.
    if (!order || (order.userId !== user.id && order.email.toLowerCase() !== user.email.toLowerCase())) {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }

    const orders = await listCustomerOrders(user);
    const match = orders.find((entry) => entry.orderId === order.id);
    if (!match) return NextResponse.json(NOT_FOUND, { status: 404 });
    return NextResponse.json({ order: { ...match, id: orderReference(order) } });
  } catch (error) {
    console.error("GET /api/orders/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
