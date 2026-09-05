export function normalizeAuthEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isValidAuthEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeAuthEmail(email));
}

export function cleanAuthName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

export function cleanAuthPhone(phone) {
  return String(phone || "").trim();
}

export async function readAuthJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

export function getLocalPasswordResetLinks(request, token) {
  const resetPath = `/account/reset?token=${encodeURIComponent(token)}`;
  const origin = new URL(request.url).origin;

  return {
    resetPath,
    resetUrl: `${origin}${resetPath}`,
  };
}
