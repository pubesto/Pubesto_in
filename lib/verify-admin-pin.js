// Client helper for the admin pages: asks the server whether a PIN is valid.
export async function verifyAdminPin(pin) {
  if (!pin) return false;
  try {
    const res = await fetch("/api/admin/verify", { method: "POST", headers: { "x-admin-pin": pin } });
    return res.ok;
  } catch {
    return false;
  }
}
