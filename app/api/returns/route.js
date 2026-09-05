import { NextResponse } from "next/server";

// In-memory store — persists for server process lifetime.
// In production, swap with Firestore / Supabase / MongoDB.
if (!global._returnsStore) {
  global._returnsStore = [];
}

function generateReturnId() {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `RET-${num}`;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const id = searchParams.get("id");

    // Admin PIN check for full list
    const adminPin = request.headers.get("x-admin-pin");
    const validPin = process.env.ADMIN_PIN || "pubesto2024";

    if (id) {
      // Public: lookup by return ID (for customer tracking)
      const found = global._returnsStore.find((r) => r.id === id);
      if (!found) {
        return NextResponse.json({ error: "Return request not found." }, { status: 404 });
      }
      // Return safe fields only (no internal admin notes if not admin)
      const isAdmin = adminPin === validPin;
      if (!isAdmin) {
        const { adminInternalNotes, ...safe } = found;
        return NextResponse.json(safe);
      }
      return NextResponse.json(found);
    }

    // Admin-only: full list
    if (adminPin !== validPin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let results = [...global._returnsStore];
    if (status && status !== "all") {
      results = results.filter((r) => r.status === status);
    }

    // Sort newest first
    results.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    return NextResponse.json(results);
  } catch (error) {
    console.error("GET /api/returns error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      orderId,
      customerEmail,
      customerName,
      customerPhone,
      reason,
      reasonText,
      images,
      productName,
    } = body;

    if (!orderId || !customerEmail || !reason) {
      return NextResponse.json(
        { error: "Order ID, email, and reason are required." },
        { status: 400 }
      );
    }

    // Check for duplicate submission (same order + email)
    const duplicate = global._returnsStore.find(
      (r) =>
        r.orderId.toLowerCase() === String(orderId).toLowerCase() &&
        r.customerEmail.toLowerCase() === customerEmail.toLowerCase()
    );
    if (duplicate) {
      return NextResponse.json(
        {
          error: "A return request for this order has already been submitted.",
          existingId: duplicate.id,
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const returnId = generateReturnId();

    const newReturn = {
      id: returnId,
      orderId: String(orderId).trim(),
      customerEmail: customerEmail.trim().toLowerCase(),
      customerName: customerName?.trim() || "Customer",
      customerPhone: customerPhone?.trim() || "",
      productName: productName?.trim() || "",
      reason,
      reasonText: reasonText?.trim() || "",
      images: images || [], // base64 strings or URLs
      status: "pending",
      adminNotes: "",
      adminInternalNotes: "",
      rejectionReason: "",
      submittedAt: now,
      updatedAt: now,
      timeline: [
        {
          status: "pending",
          label: "Return Request Submitted",
          date: now,
          note: "Your return request has been received. We'll review it within 1–2 business days.",
        },
      ],
    };

    global._returnsStore.push(newReturn);

    return NextResponse.json(
      { success: true, returnId, message: "Return request submitted successfully." },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/returns error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
