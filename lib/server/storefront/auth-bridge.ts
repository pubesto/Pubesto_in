import "server-only"

import { NextResponse } from "next/server"

/**
 * The storefront keeps its original /api/auth/* JSON endpoints; under the
 * hood they call better-auth. This copies better-auth's session cookies onto
 * the JSON response we send back.
 */
export function withAuthCookies(source: Response, body: unknown, init?: { status?: number }) {
  const response = NextResponse.json(body, init)
  for (const cookie of source.headers.getSetCookie()) {
    response.headers.append("set-cookie", cookie)
  }
  return response
}

/** better-auth error body → a short message for the storefront forms. */
export async function authErrorMessage(source: Response, fallback: string) {
  try {
    const data = (await source.clone().json()) as { message?: string; code?: string }
    return data?.message || fallback
  } catch {
    return fallback
  }
}

/** Remove the legacy (pre-migration) storefront session cookie. */
export function clearLegacySession(response: NextResponse) {
  // Raw header: response.cookies.set() would rewrite Set-Cookie and drop the
  // better-auth session cookies appended above.
  response.headers.append("set-cookie", "pubesto_session=; Path=/; Max-Age=0")
  return response
}
