import crypto from "crypto";

// Admin endpoints (reviews moderation, returns, cancellations) accept an `x-admin-pin`
// header. The PIN only ever lives in the server env, never in client code, and there is
// no default: if ADMIN_PIN is unset, admin access is disabled.
export function isAdminRequest(request) {
  const expected = process.env.ADMIN_PIN;
  const provided = request.headers.get("x-admin-pin");
  if (!expected || expected.length < 8 || !provided) return false;

  const a = crypto.createHash("sha256").update(String(provided)).digest();
  const b = crypto.createHash("sha256").update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}
