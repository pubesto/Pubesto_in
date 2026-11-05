import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getPrisma } from "@/lib/server/db";
import { clearLegacySession, withAuthCookies } from "@/lib/server/storefront/auth-bridge";
import { isValidAuthEmail, normalizeAuthEmail, readAuthJson } from "@/lib/auth-validation";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await readAuthJson(request);
    const email = normalizeAuthEmail(body.email);
    const password = String(body.password || "");

    if (!isValidAuthEmail(email) || !password) {
      return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
    }

    const result = await getAuth().api.signInEmail({
      body: { email, password },
      headers: request.headers,
      asResponse: true,
    });

    if (!result.ok) {
      // Accounts moved over from the old Shopify store have no password here yet.
      const existing = await getPrisma().user.findUnique({
        where: { email },
        select: { accounts: { select: { providerId: true } } },
      });
      if (existing && !existing.accounts.some((account) => account.providerId === "credential")) {
        const viaGoogle = existing.accounts.some((account) => account.providerId === "google");
        return NextResponse.json(
          {
            error: viaGoogle
              ? "This account uses Google sign-in. Tap “Continue with Google”."
              : "We've upgraded our store. Please tap “Forgot password” once to set a new password — your orders and addresses are safe.",
            code: "PASSWORD_NOT_SET",
          },
          { status: 401 }
        );
      }
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const data = await result.clone().json();
    return clearLegacySession(withAuthCookies(result, { success: true, user: data?.user ?? null }));
  } catch (error) {
    console.error("POST /api/auth/login error:", error);
    return NextResponse.json({ error: "Login failed. Please try again." }, { status: 500 });
  }
}
