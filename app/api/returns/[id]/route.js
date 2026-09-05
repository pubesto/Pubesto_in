import { NextResponse } from "next/server";

if (!global._returnsStore) {
  global._returnsStore = [];
}

const STATUS_FLOW = {
  pending: "pending",
  under_review: "under_review",
  approved: "approved",
  rejected: "rejected",
  refund_initiated: "refund_initiated",
};

const STATUS_LABELS = {
  pending: "Return Request Submitted",
  under_review: "Under Review",
  approved: "Return Approved",
  rejected: "Return Rejected",
  refund_initiated: "Refund Initiated",
};

const STATUS_NOTES = {
  under_review: "Our team is reviewing your return request and the provided evidence.",
  approved:
    "Your return has been approved. Please ship the product back within 5 business days.",
  rejected: "Unfortunately, your return request could not be approved at this time.",
  refund_initiated:
    "Your refund has been initiated and will reflect in 5–10 business days.",
};

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const adminPin = request.headers.get("x-admin-pin");
    const validPin = process.env.ADMIN_PIN || "pubesto2024";
    const isAdmin = adminPin === validPin;

    const found = global._returnsStore.find((r) => r.id === id);
    if (!found) {
      return NextResponse.json({ error: "Return request not found." }, { status: 404 });
    }

    if (!isAdmin) {
      const { adminInternalNotes, ...safe } = found;
      return NextResponse.json(safe);
    }

    return NextResponse.json(found);
  } catch (error) {
    console.error("GET /api/returns/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const adminPin = request.headers.get("x-admin-pin");
    const validPin = process.env.ADMIN_PIN || "pubesto2024";

    if (adminPin !== validPin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { status, adminNotes, adminInternalNotes, rejectionReason } = body;

    const idx = global._returnsStore.findIndex((r) => r.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: "Return request not found." }, { status: 404 });
    }

    const existing = global._returnsStore[idx];
    const now = new Date().toISOString();

    const updates = {
      updatedAt: now,
    };

    if (status && STATUS_FLOW[status]) {
      updates.status = status;

      // Add timeline entry
      const timelineEntry = {
        status,
        label: STATUS_LABELS[status] || status,
        date: now,
        note: adminNotes || STATUS_NOTES[status] || "",
      };

      updates.timeline = [...existing.timeline, timelineEntry];
    }

    if (adminNotes !== undefined) updates.adminNotes = adminNotes;
    if (adminInternalNotes !== undefined) updates.adminInternalNotes = adminInternalNotes;
    if (rejectionReason !== undefined) updates.rejectionReason = rejectionReason;

    global._returnsStore[idx] = { ...existing, ...updates };

    return NextResponse.json({
      success: true,
      return: global._returnsStore[idx],
    });
  } catch (error) {
    console.error("PATCH /api/returns/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const adminPin = request.headers.get("x-admin-pin");
    const validPin = process.env.ADMIN_PIN || "pubesto2024";

    if (adminPin !== validPin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idx = global._returnsStore.findIndex((r) => r.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: "Return request not found." }, { status: 404 });
    }

    global._returnsStore.splice(idx, 1);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/returns/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
