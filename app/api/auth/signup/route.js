import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, createSessionToken, getSessionCookieOptions } from "../../../../lib/auth-session";
import { createShopifyCustomer } from "../../../../lib/shopify-customer";
import {
  cleanAuthName,
  cleanAuthPhone,
  isValidAuthEmail,
  normalizeAuthEmail,
  readAuthJson,
} from "../../../../lib/auth-validation";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await readAuthJson(request);
    const input = {
      name: cleanAuthName(body.name),
      email: normalizeAuthEmail(body.email),
      phone: cleanAuthPhone(body.phone),
      password: String(body.password || ""),
    };

    if (!input.name) {
      return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
    }
    if (!isValidAuthEmail(input.email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (input.password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    let authResult;
    try {
      authResult = await createShopifyCustomer(input);
    } catch (error) {
      return NextResponse.json({ error: error.message || "Signup failed." }, { status: 400 });
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

    return NextResponse.json({ success: true, user: authResult.user }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Signup failed." }, { status: 400 });
  }
}
