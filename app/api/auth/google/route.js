import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getSafeRedirectPath } from "@/lib/utils";

export const dynamic = "force-dynamic";

function loginError(request, code) {
  const url = new URL("/account/login", request.url);
  url.searchParams.set("authError", code);
  return NextResponse.redirect(url);
}

/** Starts Google sign-in (better-auth) and returns to ?redirect= afterwards. */
export async function GET(request) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return loginError(request, "google_config");
  }

  const redirectTo = getSafeRedirectPath(new URL(request.url).searchParams.get("redirect"), "/account");
  try {
    const result = await getAuth().api.signInSocial({
      body: {
        provider: "google",
        callbackURL: redirectTo,
        errorCallbackURL: "/account/login?authError=google_failed",
      },
      headers: request.headers,
      asResponse: true,
    });
    const data = await result.json();
    if (!data?.url) return loginError(request, "google_failed");

    const response = NextResponse.redirect(data.url);
    for (const cookie of result.headers.getSetCookie()) {
      response.headers.append("set-cookie", cookie);
    }
    return response;
  } catch (error) {
    console.error("GET /api/auth/google error:", error);
    return loginError(request, "google_failed");
  }
}
