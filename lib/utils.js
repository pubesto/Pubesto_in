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
