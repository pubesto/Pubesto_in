import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Google redirects here (the URI already registered in Google Cloud). Hand the
 * request to better-auth's own callback handler, which creates the session.
 */
export async function GET(request) {
  const url = new URL(request.url);
  url.pathname = "/api/auth/callback/google";
  return getAuth().handler(new Request(url, { method: "GET", headers: request.headers }));
}
