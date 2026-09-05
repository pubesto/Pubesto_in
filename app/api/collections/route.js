import { NextResponse } from "next/server";
import { getShopifyCollections } from "../../../lib/shopify";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const collections = await getShopifyCollections();
    return NextResponse.json(collections);
  } catch (error) {
    console.error("Error in /api/collections:", error);
    return NextResponse.json({ error: "Failed to fetch collections" }, { status: 500 });
  }
}
