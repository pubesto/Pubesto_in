import { NextResponse } from "next/server";
import { getStorefrontUser, listCustomerOrders } from "@/lib/server/storefront/account";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getStorefrontUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ orders: await listCustomerOrders(user) });
  } catch (error) {
    console.error("GET /api/account/orders error:", error);
    return NextResponse.json({ error: "Could not load your orders." }, { status: 500 });
  }
}
