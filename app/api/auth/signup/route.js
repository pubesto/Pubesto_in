import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getPrisma } from "@/lib/server/db";
import { authErrorMessage, clearLegacySession, withAuthCookies } from "@/lib/server/storefront/auth-bridge";
import {
  cleanAuthName,
  cleanAuthPhone,
  isValidAuthEmail,
  normalizeAuthEmail,
  readAuthJson,
} from "@/lib/auth-validation";

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

    const existing = await getPrisma().user.findUnique({
      where: { email: input.email },
      select: { accounts: { select: { providerId: true } } },
    });
    if (existing) {
      const hasPassword = existing.accounts.some((account) => account.providerId === "credential");
      return NextResponse.json(
        {
          error: hasPassword
            ? "An account with this email already exists. Please log in."
            : "You already have an account from our previous store. Tap “Forgot password” to set a password — your orders are waiting.",
          code: hasPassword ? "USER_EXISTS" : "PASSWORD_NOT_SET",
        },
        { status: 409 }
      );
    }

    const result = await getAuth().api.signUpEmail({
      body: {
        name: input.name,
        email: input.email,
        password: input.password,
        ...(input.phone ? { phone: input.phone } : {}),
      },
      headers: request.headers,
      asResponse: true,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: await authErrorMessage(result, "Signup failed. Please try again.") },
        { status: 400 }
      );
    }

    const data = await result.clone().json();
    return clearLegacySession(
      withAuthCookies(result, { success: true, user: data?.user ?? null }, { status: 201 })
    );
  } catch (error) {
    console.error("POST /api/auth/signup error:", error);
    return NextResponse.json({ error: "Signup failed. Please try again." }, { status: 500 });
  }
}
