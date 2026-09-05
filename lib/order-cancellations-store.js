import fs from "fs/promises";
import path from "path";

const CANCELLATIONS_FILE = path.join(process.cwd(), "data", "order-cancellations.json");

let cachedCancellations = null;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function makeCancellationId() {
  const number = Math.floor(100000 + Math.random() * 900000);
  return `CAN-${number}`;
}

function normalizeCancellation(cancellation) {
  const createdAt = cancellation.createdAt || cancellation.submittedAt || nowIso();

  return {
    id: String(cancellation.id || makeCancellationId()),
    orderId: String(cancellation.orderId || "").trim(),
    customerEmail: normalizeEmail(cancellation.customerEmail),
    customerName: String(cancellation.customerName || "Customer").trim(),
    customerPhone: String(cancellation.customerPhone || "").trim(),
    productName: String(cancellation.productName || "").trim(),
    reason: String(cancellation.reason || "").trim(),
    reasonText: String(cancellation.reasonText || cancellation.notes || "").trim(),
    status: String(cancellation.status || "requested").trim(),
    adminNotes: String(cancellation.adminNotes || "").trim(),
    createdAt,
    updatedAt: cancellation.updatedAt || createdAt,
    timeline: Array.isArray(cancellation.timeline) ? cancellation.timeline : [],
  };
}

function sortCancellations(cancellations) {
  return [...cancellations].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export async function readOrderCancellations() {
  if (cachedCancellations) return cachedCancellations;

  try {
    const raw = await fs.readFile(CANCELLATIONS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    cachedCancellations = Array.isArray(parsed)
      ? sortCancellations(parsed.map(normalizeCancellation))
      : [];
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Failed to read order cancellations file:", error);
    }
    cachedCancellations = [];
  }

  return cachedCancellations;
}

export async function writeOrderCancellations(cancellations) {
  const normalized = sortCancellations(cancellations.map(normalizeCancellation));
  await fs.mkdir(path.dirname(CANCELLATIONS_FILE), { recursive: true });
  await fs.writeFile(CANCELLATIONS_FILE, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  cachedCancellations = normalized;
  return normalized;
}

export function findDuplicateCancellation(cancellations, { orderId, customerEmail }) {
  const normalizedOrderId = String(orderId || "").trim().toLowerCase();
  const normalizedEmail = normalizeEmail(customerEmail);

  return cancellations.find((cancellation) => (
    cancellation.orderId.toLowerCase() === normalizedOrderId &&
    cancellation.customerEmail === normalizedEmail
  ));
}

export function makeOrderCancellation(input) {
  const now = nowIso();
  const id = makeCancellationId();

  return normalizeCancellation({
    ...input,
    id,
    status: "requested",
    createdAt: now,
    updatedAt: now,
    timeline: [
      {
        status: "requested",
        label: "Cancellation Request Submitted",
        date: now,
        note: "Your cancellation request has been received and will be reviewed before dispatch.",
      },
    ],
  });
}

export function sanitizeOrderCancellation(cancellation, { includeAdmin = false } = {}) {
  if (!cancellation) return null;
  const normalized = normalizeCancellation(cancellation);

  if (includeAdmin) return normalized;

  const { adminNotes, ...safeCancellation } = normalized;
  return safeCancellation;
}
