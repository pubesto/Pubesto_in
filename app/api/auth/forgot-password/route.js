import { NextResponse } from "next/server";
import { recoverShopifyCustomerPassword } from "../../../../lib/shopify-customer";
import { isValidAuthEmail, normalizeAuthEmail, readAuthJson } from "../../../../lib/auth-validation";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await readAuthJson(request);
    const email = normalizeAuthEmail(body.email);

    if (!isValidAuthEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const message = "If an account exists for that email, password reset instructions are ready.";

    try {
      await recoverShopifyCustomerPassword(email);
      return NextResponse.json({
        success: true,
        message,
        resetUrl: "",
      });
    } catch (error) {
      return NextResponse.json({ error: error.message || "Could not start password reset." }, { status: 400 });
    }
  } catch (error) {
    console.error("POST /api/auth/forgot-password error:", error);
    return NextResponse.json({ error: "Could not start password reset." }, { status: 500 });
  }
}
