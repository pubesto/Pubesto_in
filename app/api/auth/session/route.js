import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, parseSessionToken } from "../../../../lib/auth-session";
import { getShopifyCustomer } from "../../../../lib/shopify-customer";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = parseSessionToken(token);

  if (!session) {
    return NextResponse.json({ user: null });
  }

  if (session.provider === "shopify" && session.customerAccessToken) {
    try {
      const user = await getShopifyCustomer(session.customerAccessToken);
      return NextResponse.json({ user });
    } catch (error) {
      console.error("GET /api/auth/session Shopify error:", error);
      return NextResponse.json({ user: null });
    }
  } else if (session.provider === "google") {
    return NextResponse.json({
      user: {
        id: session.sub,
        name: session.name,
        email: session.email,
        provider: "google",
      }
    });
  }

  return NextResponse.json({ user: null });
}
