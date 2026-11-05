import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { isValidAuthEmail, normalizeAuthEmail, readAuthJson } from "@/lib/auth-validation";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await readAuthJson(request);
    const email = normalizeAuthEmail(body.email);

    if (!isValidAuthEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    // The emailed link goes through better-auth, then lands on /account/reset?token=…
    await getAuth().api.requestPasswordReset({
      body: { email, redirectTo: "/account/reset" },
      headers: request.headers,
    });

    return NextResponse.json({
      success: true,
      message: "If an account exists for that email, we've sent a link to set a new password.",
      resetUrl: "",
    });
  } catch (error) {
    console.error("POST /api/auth/forgot-password error:", error);
    return NextResponse.json({ error: "Could not start password reset. Please try again." }, { status: 500 });
  }
}
