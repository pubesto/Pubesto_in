// Meta Pixel standard events. The base pixel + PageView is loaded in app/layout.jsx.
// Every call is safe when the pixel is blocked or not yet loaded (fbq queues calls
// made before fbevents.js finishes loading).

const CURRENCY = "INR";

function parsePrice(value) {
  if (typeof value === "number") return value;
  const match = String(value || "").replace(/,/g, "").match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function unitPrice(product) {
  return product?.salePrice || parsePrice(product?.price) || 0;
}

export function getPixelContentId(product) {
  return String(product?.slug || product?.shopifyHandle || product?.sku || product?.name || "");
}

function newEventId(name) {
  return `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function trackPixel(eventName, params = {}) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  try {
    // eventID lets a future Conversions API integration de-duplicate against these.
    window.fbq("track", eventName, params, { eventID: newEventId(eventName) });
  } catch {
    /* never let analytics break shopping */
  }
}

export function trackViewContent(product) {
  if (!product) return;
  trackPixel("ViewContent", {
    content_ids: [getPixelContentId(product)],
    content_name: product.name,
    content_category: product.categories?.[0],
    content_type: "product",
    value: unitPrice(product),
    currency: CURRENCY,
  });
}

export function trackAddToCart(product, quantity = 1) {
  if (!product) return;
  const qty = Math.max(1, Number(quantity) || 1);
  trackPixel("AddToCart", {
    content_ids: [getPixelContentId(product)],
    content_name: product.name,
    content_type: "product",
    contents: [{ id: getPixelContentId(product), quantity: qty, item_price: unitPrice(product) }],
    value: unitPrice(product) * qty,
    currency: CURRENCY,
  });
}

function cartContents(items) {
  return (items || []).map((item) => {
    const product = item.product || item;
    return { id: getPixelContentId(product), quantity: Math.max(1, Number(item.quantity) || 1), item_price: unitPrice(product) };
  });
}

// Logged-out shoppers tap checkout, log in, then tap again: count that as one checkout.
const INITIATE_CHECKOUT_DEDUPE_MS = 30 * 60 * 1000;

export function trackInitiateCheckout(items, value) {
  const contents = cartContents(items);
  if (!contents.length) return;
  try {
    const signature = contents.map((c) => `${c.id}x${c.quantity}`).sort().join("|");
    const last = JSON.parse(sessionStorage.getItem("pubesto_pixel_ic") || "null");
    if (last?.signature === signature && Date.now() - last.at < INITIATE_CHECKOUT_DEDUPE_MS) return;
    sessionStorage.setItem("pubesto_pixel_ic", JSON.stringify({ signature, at: Date.now() }));
  } catch {
    /* storage unavailable: track anyway */
  }
  trackPixel("InitiateCheckout", {
    content_ids: contents.map((c) => c.id),
    content_type: "product",
    contents,
    num_items: contents.reduce((sum, c) => sum + c.quantity, 0),
    value: Math.round(Number(value) || 0),
    currency: CURRENCY,
  });
}

export function trackPurchase(items, value) {
  const contents = cartContents(items);
  if (!contents.length) return;
  trackPixel("Purchase", {
    content_ids: contents.map((c) => c.id),
    content_type: "product",
    contents,
    num_items: contents.reduce((sum, c) => sum + c.quantity, 0),
    value: Math.round(Number(value) || 0),
    currency: CURRENCY,
  });
}

export function trackSearch(query) {
  if (!query) return;
  trackPixel("Search", { search_string: String(query).slice(0, 100) });
}
