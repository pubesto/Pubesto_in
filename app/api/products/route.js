import { NextResponse } from "next/server";
import { getStorefrontCatalog } from "@/lib/server/storefront/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const { products } = await getStorefrontCatalog();
  return NextResponse.json(products);
}
