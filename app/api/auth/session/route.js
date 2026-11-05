import { NextResponse } from "next/server";
import { getStorefrontUser } from "@/lib/server/storefront/account";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getStorefrontUser();
    return NextResponse.json({ user });
  } catch (error) {
    console.error("GET /api/auth/session error:", error);
    return NextResponse.json({ user: null });
  }
}
