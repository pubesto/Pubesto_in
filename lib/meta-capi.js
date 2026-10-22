// Meta Conversions API: sends the same events as the browser pixel from our server,
// so they still count when ad blockers or iOS privacy settings block fbevents.js.
// Browser and server copies share an event_id, which Meta uses to de-duplicate them.

import { createHash } from "crypto";

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

export function isMetaCapiConfigured() {
  return Boolean(process.env.META_PIXEL_ID && process.env.META_CAPI_ACCESS_TOKEN);
}

export async function sendMetaEvent({ eventName, eventId, eventSourceUrl, customData, user }) {
  if (!isMetaCapiConfigured()) return { skipped: true };

  const userData = {
    client_ip_address: user.ip || undefined,
    client_user_agent: user.userAgent || undefined,
    fbp: user.fbp || undefined,
    fbc: user.fbc || undefined,
    em: user.email ? [sha256(user.email)] : undefined,
    external_id: user.id ? [sha256(user.id)] : undefined,
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
  if (process.env.META_CAPI_TEST_EVENT_CODE) {
    body.test_event_code = process.env.META_CAPI_TEST_EVENT_CODE;
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${process.env.META_PIXEL_ID}/events?access_token=${encodeURIComponent(process.env.META_CAPI_ACCESS_TOKEN)}`;
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
