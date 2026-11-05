import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/dal/auth";
import { listPublishedReviews, toStorefrontReview } from "@/lib/server/storefront/reviews";

export const dynamic = "force-dynamic";
const REVIEW_TEXT_MIN_LENGTH = 20;
const REVIEW_TEXT_MAX_LENGTH = 500;
const REVIEW_NAME_MAX_LENGTH = 50;

function validateReviewPayload(body) {
  const customerName = String(body.customerName || "").trim();
  const reviewText = String(body.text || "").trim();

  if (!customerName) return "Customer name is required.";
  if (customerName.length < 2) return "Please enter a valid name.";
  if (customerName.length > REVIEW_NAME_MAX_LENGTH) return `Name must be at most ${REVIEW_NAME_MAX_LENGTH} characters.`;
  if (!reviewText) return "Review text is required.";
  if (reviewText.length < REVIEW_TEXT_MIN_LENGTH) return `Please write at least ${REVIEW_TEXT_MIN_LENGTH} characters.`;
  if (reviewText.length > REVIEW_TEXT_MAX_LENGTH) return `Review text must be at most ${REVIEW_TEXT_MAX_LENGTH} characters.`;
  const rating = Number(body.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return "Rating must be between 1 and 5.";
  return null;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    return NextResponse.json(
      await listPublishedReviews({
        scope: searchParams.get("scope"),
        productSlug: searchParams.get("productSlug"),
      })
    );
  } catch (error) {
    console.error("GET /api/reviews error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Public review submission. It waits for approval in the dashboard
 * (Reviews): shoppers can't self-publish, pin to the homepage or add images.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const validationError = validateReviewPayload(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const user = await getCurrentUser().catch(() => null);
    const row = await getPrisma().productReview.create({
      data: {
        customerName: String(body.customerName).trim().slice(0, 50),
        text: String(body.text).trim().slice(0, 500),
        rating: Math.min(5, Math.max(1, Math.round(Number(body.rating)))),
        productSlug: String(body.productSlug || "").trim().toLowerCase() || null,
        productName: String(body.productName || "").trim().slice(0, 160) || null,
        isPublished: false,
        showOnHomepage: false,
        userId: user?.id ?? null,
      },
    });

    const { summary } = await listPublishedReviews({ productSlug: row.productSlug });
    return NextResponse.json({ success: true, review: toStorefrontReview(row), summary }, { status: 201 });
  } catch (error) {
    console.error("POST /api/reviews error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
