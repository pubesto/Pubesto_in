import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names with Tailwind CSS conflict resolution.
 * Standard shadcn/ui utility function.
 *
 * @param {...(string|undefined|null|boolean|object)} inputs - Class names to merge
 * @returns {string} Merged class string
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatPrice(value) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

export function formatINR(value) {
  return `₹${Math.round(Number(value) || 0).toLocaleString("en-IN")}`;
}

export function parsePriceValue(value) {
  if (typeof value === "number") return value || null;
  // Take the first number so the dot in "Rs." isn't read as a decimal point.
  const match = String(value || "").replace(/,/g, "").match(/\d+(\.\d+)?/);
  const num = match ? Number(match[0]) : 0;
  return num > 0 ? num : null;
}

export function getSalePrice(product) {
  return product?.salePrice || parsePriceValue(product?.price) || 0;
}

export function getOriginalPrice(product) {
  return product?.originalPrice || parsePriceValue(product?.oldPrice) || 0;
}

export function getDiscountPercent(product) {
  const sale = getSalePrice(product);
  const original = getOriginalPrice(product);
  return sale && original > sale ? Math.round(((original - sale) / original) * 100) : 0;
}

// Products with real catalogue imagery, de-duplicated by slug.
export function getListableProducts(products = []) {
  const seen = new Set();
  return products.filter((product) => {
    if (!product?.image || seen.has(product.slug)) return false;
    const img = String(product.image);
    const ok = (img.startsWith("/images/") || img.includes("shopify.com")) && !img.includes("unsplash.com");
    if (ok) seen.add(product.slug);
    return ok;
  });
}

export function productInCategory(product, categoryName) {
  if (!categoryName) return true;
  if (categoryName === "Sale") return getDiscountPercent(product) > 0;
  return (product.categories || []).some((cat) => cat.toLowerCase() === categoryName.toLowerCase());
}

// Accept only same-site paths like "/account?tab=orders". Rejects "//evil.com",
// "/\evil.com" and control characters, which browsers can treat as another origin.
export function getSafeRedirectPath(value, fallback = "/account") {
  const path = String(value || "");
  if (!path.startsWith("/") || path.startsWith("//") || /[\\\x00-\x1f\x7f]/.test(path)) return fallback;
  try {
    const base = "https://pubesto.invalid";
    const url = new URL(path, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}

// ---- Merchandising (driven by Shopify data; see getShopifyProducts) ----

export const NEW_ARRIVAL_DAYS = 21;
export const BESTSELLER_BADGE_TOP = 3;

function createdTime(product) {
  const t = Date.parse(product?.createdAt || "");
  return Number.isFinite(t) ? t : 0;
}

export function isNewArrival(product, now = Date.now()) {
  const t = createdTime(product);
  return t > 0 && now - t <= NEW_ARRIVAL_DAYS * 24 * 60 * 60 * 1000;
}

export function isTopBestseller(product) {
  return Boolean(product?.salesRank) && product.salesRank <= BESTSELLER_BADGE_TOP;
}

const UNRANKED = 1e9;

// Newest upload first; products without a Shopify date (local fallback) go last.
export const byNewest = (a, b) => createdTime(b) - createdTime(a);

// Shopify's real best-selling order; falls back to review count when ranks are missing.
export const byBestSelling = (a, b) =>
  (a.salesRank || UNRANKED) - (b.salesRank || UNRANKED) || (Number(b.reviews) || 0) - (Number(a.reviews) || 0);

// The merchant's own order in the Shopify "Home page" / "featured" collection.
export const byFeatured = (a, b) => (a.featuredRank || UNRANKED) - (b.featuredRank || UNRANKED);

export function hasTag(product, tags) {
  const wanted = tags.map((t) => t.toLowerCase());
  return (product?.tags || []).some((t) => wanted.includes(String(t).toLowerCase()));
}
