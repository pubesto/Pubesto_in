export const DEFAULT_SHOPIFY_STORE_DOMAIN = "jjiygt-gt.myshopify.com";

const PLACEHOLDER_DOMAINS = new Set([
  "your-store.myshopify.com",
  "your-checkout-domain.example",
]);

export function normalizeShopifyDomain(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";

  try {
    const parsed = new URL(rawValue.includes("://") ? rawValue : `https://${rawValue}`);
    return parsed.hostname.toLowerCase();
  } catch {
    return rawValue
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .toLowerCase();
  }
}

export function getShopifyStoreDomain() {
  const configuredDomain = normalizeShopifyDomain(process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN);
  return configuredDomain && !PLACEHOLDER_DOMAINS.has(configuredDomain)
    ? configuredDomain
    : DEFAULT_SHOPIFY_STORE_DOMAIN;
}

export function getShopifyCheckoutDomain() {
  const serverCheckoutDomain = typeof window === "undefined" ? process.env.SHOPIFY_CHECKOUT_DOMAIN : "";
  const configuredDomain = normalizeShopifyDomain(
    process.env.NEXT_PUBLIC_SHOPIFY_CHECKOUT_DOMAIN || serverCheckoutDomain
  );
  const storeDomain = getShopifyStoreDomain();

  if (!configuredDomain || PLACEHOLDER_DOMAINS.has(configuredDomain) || configuredDomain === storeDomain) {
    return "";
  }

  return configuredDomain;
}

function isShopifyCheckoutHost(hostname) {
  const sourceDomain = normalizeShopifyDomain(hostname);
  return sourceDomain === getShopifyStoreDomain() || sourceDomain.endsWith(".myshopify.com");
}

export function fixShopifyCheckoutUrl(url) {
  const checkoutDomain = getShopifyCheckoutDomain();
  if (!url || !checkoutDomain) return url;

  try {
    const parsedUrl = new URL(url);
    if (!isShopifyCheckoutHost(parsedUrl.hostname)) return url;

    parsedUrl.protocol = "https:";
    parsedUrl.hostname = checkoutDomain;
    parsedUrl.port = "";
    return parsedUrl.toString();
  } catch {
    return url;
  }
}
