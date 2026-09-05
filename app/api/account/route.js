import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, createSessionToken, getSessionCookieOptions, parseSessionToken } from "../../../lib/auth-session";
import { getShopifyCustomer, updateShopifyCustomer, getShopifyCustomerAdmin, updateShopifyCustomerAdmin } from "../../../lib/shopify-customer";

export const dynamic = "force-dynamic";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = parseSessionToken(token);
  if (!session) return null;

  if (session.provider === "shopify" && session.customerAccessToken) {
    const user = await getShopifyCustomer(session.customerAccessToken);
    return user ? { user, session } : null;
  }
  if (session.provider === "google" && session.sub) {
    const user = (await getShopifyCustomerAdmin(session.sub)) || {
      id: session.sub,
      name: session.name,
      email: session.email,
      provider: "google",
    };
    return { user, session };
  }

  return null;
}

export async function GET() {
  try {
    const account = await getCurrentUser();
    if (!account?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ user: account.user });
  } catch (error) {
    console.error("GET /api/account error:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(request) {
  try {
    const account = await getCurrentUser();
    if (!account?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    if (account.session.provider === "shopify" && account.session.customerAccessToken) {
      const result = await updateShopifyCustomer(account.session.customerAccessToken, {
        name: body.name,
        phone: body.phone,
        addresses: body.addresses,
      });

      if (!result.user) {
        return NextResponse.json({ error: "Could not update account." }, { status: 400 });
      }

      const cookieStore = await cookies();
      cookieStore.set(
        AUTH_COOKIE_NAME,
        createSessionToken(result.user, {
          provider: "shopify",
          customerAccessToken: result.customerAccessToken,
          expiresAt: result.expiresAt,
        }),
        getSessionCookieOptions()
      );

      return NextResponse.json({ success: true, user: result.user });
    }
    
    if (account.session.provider === "google" && account.session.id) {
      const user = await updateShopifyCustomerAdmin(account.session.id, {
        name: body.name,
        phone: body.phone,
      });

      if (!user) {
        return NextResponse.json({ error: "Could not update account." }, { status: 400 });
      }

      const cookieStore = await cookies();
      cookieStore.set(
        AUTH_COOKIE_NAME,
        createSessionToken(user, {
          provider: "google",
        }),
        getSessionCookieOptions()
      );

      return NextResponse.json({ success: true, user });
    }

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  } catch (error) {
    console.error("PATCH /api/account error:", error);
    return NextResponse.json({ error: error.message || "Could not update account." }, { status: 400 });
  }
}
