import { NextResponse } from "next/server";
import { getStorefrontCatalog } from "@/lib/server/storefront/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const { categories } = await getStorefrontCatalog();
  return NextResponse.json(categories);
}
