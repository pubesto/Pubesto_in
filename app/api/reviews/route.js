import { NextResponse } from "next/server";
import { isAdminRequest } from "../../../lib/admin-auth";
import {
  filterReviews,
  makeReview,
  readReviews,
  summarizeReviews,
  writeReviews,
} from "../../../lib/reviews-store";

export const dynamic = "force-dynamic";
const REVIEW_TEXT_MIN_LENGTH = 20;
const REVIEW_TEXT_MAX_LENGTH = 500;
const REVIEW_NAME_MAX_LENGTH = 50;


function validateReviewPayload(body) {
  const customerName = String(body.customerName || "").trim();
  const reviewText = String(body.text || "").trim();

  if (!customerName) {
    return "Customer name is required.";
  }
  if (customerName.length < 2) {
    return "Please enter a valid name.";
  }
  if (customerName.length > REVIEW_NAME_MAX_LENGTH) {
    return `Name must be at most ${REVIEW_NAME_MAX_LENGTH} characters.`;
  }
  if (!reviewText) {
    return "Review text is required.";
  }
  if (reviewText.length < REVIEW_TEXT_MIN_LENGTH) {
    return `Please write at least ${REVIEW_TEXT_MIN_LENGTH} characters.`;
  }
  if (reviewText.length > REVIEW_TEXT_MAX_LENGTH) {
    return `Review text must be at most ${REVIEW_TEXT_MAX_LENGTH} characters.`;
  }
  const rating = Number(body.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return "Rating must be between 1 and 5.";
  }
  return null;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope");
    const productSlug = searchParams.get("productSlug");
    const isAdmin = isAdminRequest(request);
    const reviews = await readReviews();
    const filtered = filterReviews(reviews, {
      scope,
      productSlug,
      includeUnpublished: isAdmin,
    });

    return NextResponse.json({
      reviews: filtered,
      summary: summarizeReviews(filtered),
    });
  } catch (error) {
    console.error("GET /api/reviews error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const validationError = validateReviewPayload(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Admins (moderation page) control every field. Public submissions only supply the
    // review itself and wait for approval: they can't self-publish, pin themselves to
    // the homepage, reorder, or attach an image URL.
    const input = isAdminRequest(request)
      ? body
      : {
          customerName: body.customerName,
          text: body.text,
          rating: body.rating,
          productSlug: body.productSlug,
          productName: body.productName,
          isPublished: false,
          showOnHomepage: false,
          sortOrder: 100,
          customerImage: "",
        };

    const reviews = await readReviews();
    const review = makeReview(input);
    const savedReviews = await writeReviews([...reviews, review]);
    const productScopedSummary = summarizeReviews(
      filterReviews(savedReviews, { productSlug: review.productSlug })
    );

    return NextResponse.json(
      {
        success: true,
        review,
        summary: productScopedSummary,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/reviews error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
