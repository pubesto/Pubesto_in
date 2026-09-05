import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, createSessionToken, getSessionCookieOptions } from "../../../../lib/auth-session";
import { loginShopifyCustomer } from "../../../../lib/shopify-customer";
import { isValidAuthEmail, normalizeAuthEmail, readAuthJson } from "../../../../lib/auth-validation";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await readAuthJson(request);
    const credentials = {
      email: normalizeAuthEmail(body.email),
      password: String(body.password || ""),
    };

    if (!isValidAuthEmail(credentials.email) || !credentials.password) {
      return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
    }

    let authResult;
    try {
      authResult = await loginShopifyCustomer(credentials);
    } catch (error) {
      return NextResponse.json({ error: error.message || "Invalid email or password." }, { status: 401 });
    }

    if (!authResult?.user) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const cookieStore = await cookies();
    cookieStore.set(
      AUTH_COOKIE_NAME,
      createSessionToken(authResult.user, {
        provider: "shopify",
        customerAccessToken: authResult.customerAccessToken,
        expiresAt: authResult.expiresAt,
      }),
      getSessionCookieOptions()
    );

    return NextResponse.json({ success: true, user: authResult.user });
  } catch (error) {
    console.error("POST /api/auth/login error:", error);
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
