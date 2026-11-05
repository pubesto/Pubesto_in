import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { clearLegacySession, withAuthCookies } from "@/lib/server/storefront/auth-bridge";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const result = await getAuth().api.signOut({ headers: request.headers, asResponse: true });
    return clearLegacySession(withAuthCookies(result, { success: true }));
  } catch (error) {
    console.error("POST /api/auth/logout error:", error);
    return clearLegacySession(NextResponse.json({ success: true }));
  }
}
