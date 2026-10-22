import { NextResponse } from "next/server";
import { isAdminRequest } from "../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

// Lets the admin pages check a typed PIN without the PIN ever being in client code.
export async function POST(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
