import crypto from "crypto";
import { NextResponse } from "next/server";
import {
  buildGoogleAuthorizationUrl,
  getGoogleAuthConfig,
  getSafeAuthRedirect,
  GOOGLE_OAUTH_REDIRECT_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
} from "../../../../lib/google-auth";

export const dynamic = "force-dynamic";

const GOOGLE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 10 * 60,
  path: "/",
};

function redirectWithError(request, error) {
  const loginUrl = new URL("/account/login", request.url);
  loginUrl.searchParams.set("authError", error);
  return NextResponse.redirect(loginUrl);
}

export async function GET(request) {
  const { clientId, clientSecret, redirectUri } = getGoogleAuthConfig(request);
  const requestUrl = new URL(request.url);
  const isLocalhost = requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1";
  const isDev = process.env.NODE_ENV !== "production" || isLocalhost;

  if (!clientId || !clientSecret) {
    if (isDev) {
      const state = crypto.randomBytes(24).toString("base64url");
      const redirectTo = getSafeAuthRedirect(requestUrl.searchParams.get("redirect"));
      const callbackUrl = new URL("/api/auth/google/callback", request.url);
      callbackUrl.searchParams.set("code", "mock_code");
      callbackUrl.searchParams.set("state", state);

      const response = NextResponse.redirect(callbackUrl);
      response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, GOOGLE_COOKIE_OPTIONS);
      response.cookies.set(GOOGLE_OAUTH_REDIRECT_COOKIE, encodeURIComponent(redirectTo), GOOGLE_COOKIE_OPTIONS);
      return response;
    }
    return redirectWithError(request, "google_config");
  }

  const state = crypto.randomBytes(24).toString("base64url");
  const redirectTo = getSafeAuthRedirect(requestUrl.searchParams.get("redirect"));
  const googleUrl = buildGoogleAuthorizationUrl({ clientId, redirectUri, state });

  const response = NextResponse.redirect(googleUrl);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, GOOGLE_COOKIE_OPTIONS);
  response.cookies.set(GOOGLE_OAUTH_REDIRECT_COOKIE, encodeURIComponent(redirectTo), GOOGLE_COOKIE_OPTIONS);
  return response;
}
