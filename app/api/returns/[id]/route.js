import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db";
import { publicReturnView } from "@/lib/server/storefront/returns";

export const dynamic = "force-dynamic";

/** Public return tracking by Return ID. Status changes happen in the dashboard (Returns). */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const row = await getPrisma().returnRequest.findUnique({ where: { id: String(id).trim().toUpperCase() } });
    if (!row) {
      return NextResponse.json({ error: "Return request not found." }, { status: 404 });
    }
    return NextResponse.json(publicReturnView(row));
  } catch (error) {
    console.error("GET /api/returns/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
