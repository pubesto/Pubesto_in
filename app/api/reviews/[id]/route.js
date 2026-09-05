import { NextResponse } from "next/server";
import {
  readReviews,
  summarizeReviews,
  updateReview,
  writeReviews,
} from "../../../../lib/reviews-store";

export const dynamic = "force-dynamic";

function isAdminRequest(request) {
  const adminPin = request.headers.get("x-admin-pin");
  const validPin = process.env.ADMIN_PIN || "pubesto2024";
  return adminPin === validPin;
}

function validateReviewPayload(body) {
  if (body.customerName !== undefined && !String(body.customerName || "").trim()) {
    return "Customer name is required.";
  }
  if (body.text !== undefined && !String(body.text || "").trim()) {
    return "Review text is required.";
  }
  if (body.rating !== undefined) {
    const rating = Number(body.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return "Rating must be between 1 and 5.";
    }
  }
  return null;
}

export async function PATCH(request, { params }) {
  try {
    if (!isAdminRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validationError = validateReviewPayload(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const reviews = await readReviews();
    const index = reviews.findIndex((review) => review.id === id);
    if (index === -1) {
      return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }

    const nextReviews = [...reviews];
    nextReviews[index] = updateReview(reviews[index], body);
    const savedReviews = await writeReviews(nextReviews);

    return NextResponse.json({
      success: true,
      review: nextReviews[index],
      summary: summarizeReviews(savedReviews),
    });
  } catch (error) {
    console.error("PATCH /api/reviews/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    if (!isAdminRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const reviews = await readReviews();
    const nextReviews = reviews.filter((review) => review.id !== id);

    if (nextReviews.length === reviews.length) {
      return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }

    const savedReviews = await writeReviews(nextReviews);
    return NextResponse.json({
      success: true,
      summary: summarizeReviews(savedReviews),
    });
  } catch (error) {
    console.error("DELETE /api/reviews/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
