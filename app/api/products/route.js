import { NextResponse } from "next/server";
import { getShopifyProducts } from "../../../lib/shopify";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await getShopifyProducts();
    return NextResponse.json(products);
  } catch (error) {
    console.error("Error in /api/products:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}
