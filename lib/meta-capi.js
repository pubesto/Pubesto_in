// Meta Conversions API: sends the same events as the browser pixel from our server,
// so they still count when ad blockers or iOS privacy settings block fbevents.js.
// Browser and server copies share an event_id, which Meta uses to de-duplicate them.

import { createHash } from "crypto";
import { META_PIXEL_ID } from "./meta-config";

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || "v23.0";

export const ALLOWED_EVENTS = new Set([
  "PageView",
  "ViewContent",
  "AddToCart",
  "InitiateCheckout",
  "Purchase",
  "Search",
]);

function sha256(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized ? createHash("sha256").update(normalized).digest("hex") : undefined;
}

// META_CAPI_TOKEN / META_TEST_EVENT_CODE are accepted as aliases (older setup notes use them).
function accessToken() {
  return process.env.META_CAPI_ACCESS_TOKEN || process.env.META_CAPI_TOKEN || "";
}

function testEventCode() {
  return process.env.META_CAPI_TEST_EVENT_CODE || process.env.META_TEST_EVENT_CODE || "";
}

export function isMetaCapiConfigured() {
  return Boolean(META_PIXEL_ID && accessToken());
}

let warnedUnconfigured = false;

function hashed(value) {
  const digest = sha256(value);
  return digest ? [digest] : undefined;
}

export async function sendMetaEvent({ eventName, eventId, eventSourceUrl, customData, user }) {
  if (!isMetaCapiConfigured()) {
    if (!warnedUnconfigured) {
      warnedUnconfigured = true;
      console.warn("[meta] Conversions API is off: set META_CAPI_ACCESS_TOKEN to send server events.");
    }
    return { skipped: true };
  }

  const userData = {
    client_ip_address: user.ip || undefined,
    client_user_agent: user.userAgent || undefined,
    fbp: user.fbp || undefined,
    fbc: user.fbc || undefined,
    em: hashed(user.email),
    ph: user.phone ? hashed(String(user.phone).replace(/\D/g, "")) : undefined,
    fn: hashed(user.firstName),
    ln: hashed(user.lastName),
    ct: user.city ? hashed(String(user.city).replace(/[^a-z]/gi, "")) : undefined,
    st: hashed(user.state),
    zp: user.zip ? hashed(String(user.zip).replace(/\s/g, "")) : undefined,
    country: hashed(user.country),
    external_id: hashed(user.id),
  };

  const body = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        event_source_url: eventSourceUrl,
        action_source: "website",
        user_data: userData,
        custom_data: customData,
      },
    ],
  };
  if (testEventCode()) {
    body.test_event_code = testEventCode();
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(accessToken())}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Meta CAPI ${response.status}: ${result?.error?.message || "unknown error"}`);
  }
  return result;
}
