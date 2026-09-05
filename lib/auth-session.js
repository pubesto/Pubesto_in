import crypto from "crypto";

export const AUTH_COOKIE_NAME = "pubesto_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const TOKEN_ALGORITHM = "aes-256-gcm";

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(value) {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function getSessionSecret() {
  return process.env.AUTH_SESSION_SECRET || process.env.ADMIN_PIN || "pubesto-local-soft-login-secret";
}

function getEncryptionKey() {
  return crypto.createHash("sha256").update(getSessionSecret()).digest();
}

function signPayload(payload) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
}

function encryptValue(value) {
  if (!value) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(TOKEN_ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptValue(value) {
  if (!value) return "";
  const [iv, tag, encrypted] = String(value).split(".");
  if (!iv || !tag || !encrypted) return "";
  try {
    const decipher = crypto.createDecipheriv(
      TOKEN_ALGORITHM,
      getEncryptionKey(),
      Buffer.from(iv, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}

function getExpirySeconds(expiresAt) {
  const defaultExpiry = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  if (!expiresAt) return defaultExpiry;

  const shopifyExpiry = Math.floor(new Date(expiresAt).getTime() / 1000);
  if (!Number.isFinite(shopifyExpiry)) return defaultExpiry;
  return Math.min(defaultExpiry, shopifyExpiry);
}

export function createSessionToken(customer, options = {}) {
  const payload = base64UrlEncode(JSON.stringify({
    sub: customer.id,
    email: customer.email,
    name: customer.name || customer.displayName || "",
    provider: options.provider || customer.provider || "local",
    sat: encryptValue(options.customerAccessToken),
    exp: getExpirySeconds(options.expiresAt),
  }));
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function parseSessionToken(token) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) return null;

  const expectedSignature = signPayload(payload);
  const providedSignature = Buffer.from(signature);
  const validSignature = Buffer.from(expectedSignature);
  if (
    providedSignature.length !== validSignature.length ||
    !crypto.timingSafeEqual(providedSignature, validSignature)
  ) {
    return null;
  }

  try {
    const session = JSON.parse(base64UrlDecode(payload));
    if (!session.sub || !session.exp || session.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (session.sat) {
      session.customerAccessToken = decryptValue(session.sat);
      delete session.sat;
    }
    return session;
  } catch {
    return null;
  }
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  };
}

export function getClearSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  };
}
