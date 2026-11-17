// The one Meta pixel the site uses. The browser pixel (layout.jsx) and the Conversions API
// (meta-capi.js) must send to the same pixel, otherwise Meta can't de-duplicate events by
// event_id. 2788… is the pixel the Conversions API access token was issued for.
export const META_PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID || process.env.META_PIXEL_ID || "27881346908132910";
