import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, parseSessionToken } from "../../../lib/auth-session";
import { ALLOWED_EVENTS, sendMetaEvent } from "../../../lib/meta-capi";

export const dynamic = "force-dynamic";

function clientIp(headerStore) {
  const forwarded = headerStore.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : headerStore.get("x-real-ip") || "";
}

// _fbc is set by the pixel after an ad click; build it from fbclid if the pixel was blocked.
function clickId(cookieStore, eventSourceUrl) {
  const fbc = cookieStore.get("_fbc")?.value;
  if (fbc) return fbc;
  try {
    const fbclid = new URL(eventSourceUrl).searchParams.get("fbclid");
    return fbclid ? `fb.1.${Date.now()}.${fbclid}` : "";
  } catch {
    return "";
  }
}

export async function POST(req) {
  let payload;
  try {
    payload = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { eventName, eventId, eventSourceUrl, customData } = payload || {};
  if (!ALLOWED_EVENTS.has(eventName) || typeof eventId !== "string" || eventId.length > 100) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const cookieStore = await cookies();
  const headerStore = await headers();
  const session = parseSessionToken(cookieStore.get(AUTH_COOKIE_NAME)?.value);
  const sourceUrl = typeof eventSourceUrl === "string" ? eventSourceUrl.slice(0, 1000) : undefined;

  try {
    await sendMetaEvent({
      eventName,
      eventId,
      eventSourceUrl: sourceUrl,
      customData: customData && typeof customData === "object" ? customData : undefined,
      user: {
        ip: clientIp(headerStore),
        userAgent: headerStore.get("user-agent") || "",
        fbp: cookieStore.get("_fbp")?.value,
        fbc: clickId(cookieStore, sourceUrl),
        email: session?.email,
        id: session?.sub,
      },
    });
  } catch (error) {
    console.error("POST /api/meta-events error:", error.message);
  }

  // Always 200: tracking problems must never surface to shoppers.
  return NextResponse.json({ ok: true });
}
