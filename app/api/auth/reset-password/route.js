import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { readAuthJson } from "@/lib/auth-validation";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await readAuthJson(request);
    const token = String(body.token || "");
    const newPassword = String(body.password || body.newPassword || "");

    if (!token) {
      return NextResponse.json({ error: "This reset link is invalid or expired." }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const result = await getAuth().api.resetPassword({
      body: { token, newPassword },
      headers: request.headers,
      asResponse: true,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Please request a new one." },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: "Your password has been updated. You can log in now." });
  } catch (error) {
    console.error("POST /api/auth/reset-password error:", error);
    return NextResponse.json({ error: "Could not reset password. Please try again." }, { status: 500 });
  }
}
