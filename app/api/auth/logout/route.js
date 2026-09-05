import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, getClearSessionCookieOptions } from "../../../../lib/auth-session";

export const dynamic = "force-dynamic";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, "", getClearSessionCookieOptions());
  return NextResponse.json({ success: true });
}
