import fs from "fs/promises";
import path from "path";

const REVIEWS_FILE = path.join(process.cwd(), "data", "reviews.json");

let cachedReviews = null;

function normalizeSlug(value) {
  return String(value || "").trim().toLowerCase();
}

function clampRating(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 5;
  return Math.min(5, Math.max(1, Math.round(numeric)));
}

function getInitials(name) {
  const parts = String(name || "Customer")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "C";
}

function normalizeReview(review) {
  const now = new Date().toISOString();
  const customerName = String(review.customerName || review.name || "Customer").trim();
  const productSlug = normalizeSlug(review.productSlug);

  return {
    id: String(review.id || `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    customerName,
    customerImage: String(review.customerImage || review.image || "").trim(),
    initials: getInitials(customerName),
    rating: clampRating(review.rating),
    text: String(review.text || "").trim(),
    productSlug,
    productName: String(review.productName || "").trim(),
    showOnHomepage: Boolean(review.showOnHomepage),
    isPublished: review.isPublished !== false,
    sortOrder: Number.isFinite(Number(review.sortOrder)) ? Number(review.sortOrder) : 100,
    createdAt: review.createdAt || now,
    updatedAt: review.updatedAt || now,
  };
}

function sortReviews(reviews) {
  return [...reviews].sort((a, b) => {
    const orderDiff = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    if (orderDiff !== 0) return orderDiff;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
}

export async function readReviews() {
  if (cachedReviews) return cachedReviews;

  try {
    const raw = await fs.readFile(REVIEWS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    cachedReviews = Array.isArray(parsed) ? sortReviews(parsed.map(normalizeReview)) : [];
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Failed to read reviews file:", error);
    }
    cachedReviews = [];
  }

  return cachedReviews;
}

export async function writeReviews(reviews) {
  const normalized = sortReviews(reviews.map(normalizeReview));
  await fs.mkdir(path.dirname(REVIEWS_FILE), { recursive: true });
  await fs.writeFile(REVIEWS_FILE, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  cachedReviews = normalized;
  return normalized;
}

export function filterReviews(reviews, { productSlug, scope, includeUnpublished = false } = {}) {
  const normalizedSlug = normalizeSlug(productSlug);

  return sortReviews(
    reviews.filter((review) => {
      if (!includeUnpublished && !review.isPublished) return false;
      if (scope === "home") return review.showOnHomepage;
      if (normalizedSlug) return review.productSlug === normalizedSlug;
      return true;
    })
  );
}

export function summarizeReviews(reviews) {
  const published = reviews.filter((review) => review.isPublished !== false);
  const count = published.length;
  const averageRating = count
    ? Math.round((published.reduce((sum, review) => sum + clampRating(review.rating), 0) / count) * 10) / 10
    : 0;

  return { count, averageRating };
}

export function makeReview(input) {
  const now = new Date().toISOString();
  return normalizeReview({
    ...input,
    id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  });
}

export function updateReview(existing, input) {
  return normalizeReview({
    ...existing,
    ...input,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  });
}
