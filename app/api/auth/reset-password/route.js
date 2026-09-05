import { NextResponse } from "next/server";
import { readAuthJson } from "../../../../lib/auth-validation";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await readAuthJson(request);

    if (!body.token) {
      return NextResponse.json({ error: "This reset link is invalid or expired." }, { status: 400 });
    }
    if (String(body.password || "").length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    return NextResponse.json({ error: "Password reset is handled directly via the Shopify email link. Please check your email." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not reset password." }, { status: 400 });
  }
}
