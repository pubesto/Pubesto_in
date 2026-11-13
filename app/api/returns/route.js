import { after, NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db";
import { publicReturnView } from "@/lib/server/storefront/returns";
import { findOrderByReference, orderReference } from "@/lib/server/storefront/account";
import { parseDataUrl, saveUpload } from "@/lib/server/storage";
import { notifyReturnRequest } from "@/lib/server/notifications";

export const dynamic = "force-dynamic";

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function newReturnId() {
  return `RET-${Math.floor(100000 + Math.random() * 900000)}`;
}

export async function GET(request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Return ID is required." }, { status: 400 });
    }
    const row = await getPrisma().returnRequest.findUnique({ where: { id: id.trim().toUpperCase() } });
    if (!row) {
      return NextResponse.json({ error: "Return request not found." }, { status: 404 });
    }
    return NextResponse.json(publicReturnView(row));
  } catch (error) {
    console.error("GET /api/returns error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { orderId, customerEmail, customerName, customerPhone, reason, reasonText, images, productName } = body;

    if (!orderId || !customerEmail || !reason) {
      return NextResponse.json({ error: "Order ID, email, and reason are required." }, { status: 400 });
    }

    const prisma = getPrisma();
    const email = String(customerEmail).trim().toLowerCase();
    const order = await findOrderByReference(orderId);
    if (!order || order.email.toLowerCase() !== email) {
      return NextResponse.json(
        { error: "We couldn't find an order with that ID and email. Please check both and try again." },
        { status: 404 }
      );
    }

    const duplicate = await prisma.returnRequest.findFirst({
      where: { orderId: order.id, customerEmail: email },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "A return request for this order has already been submitted.", existingId: duplicate.id },
        { status: 409 }
      );
    }

    const imageKeys = [];
    for (const dataUrl of (Array.isArray(images) ? images : []).slice(0, MAX_IMAGES)) {
      const parsed = parseDataUrl(dataUrl);
      if (!parsed || !parsed.contentType.startsWith("image/") || parsed.data.byteLength > MAX_IMAGE_BYTES) continue;
      try {
        imageKeys.push(await saveUpload(parsed.data, parsed.contentType, "returns"));
      } catch (error) {
        console.error("Return image upload failed:", error);
      }
    }

    const now = new Date().toISOString();
    const row = await prisma.returnRequest.create({
      data: {
        id: newReturnId(),
        orderRef: orderReference(order),
        orderId: order.id,
        customerEmail: email,
        customerName: String(customerName || "Customer").trim().slice(0, 120),
        customerPhone: String(customerPhone || "").trim().slice(0, 20),
        productName: String(productName || "").trim().slice(0, 200),
        reason: String(reason).trim().slice(0, 80),
        reasonText: String(reasonText || "").trim().slice(0, 2000),
        images: imageKeys,
        status: "pending",
        timeline: [
          {
            status: "pending",
            label: "Return Request Submitted",
            date: now,
            note: "Your return request has been received. We'll review it within 1–2 business days.",
          },
        ],
      },
    });

    after(() => notifyReturnRequest(row.id, { notifyAdmin: true }));

    return NextResponse.json(
      { success: true, returnId: row.id, message: "Return request submitted successfully." },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/returns error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
