import { createHmac, timingSafeEqual } from "crypto";

function getSafeRedirectPath(value) {
  const redirectPath = String(value || "/").trim();
  if (!redirectPath.startsWith("/") || redirectPath.startsWith("//")) {
    return "/";
  }
  return redirectPath;
}

async function readCallbackParams(request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return request.json();
  }

  if (contentType.includes("form")) {
    const formData = await request.formData();
    return Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, String(value)]));
  }

  const bodyText = await request.text();
  return Object.fromEntries(new URLSearchParams(bodyText));
}

function isValidRazorpaySignature(params) {
  const orderId = params.razorpay_order_id;
  const paymentId = params.razorpay_payment_id;
  const signature = params.razorpay_signature;
  const secret = process.env.RAZORPAY_KEY_SECRET;

  if (!orderId || !paymentId || !signature || !secret) {
    return false;
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const actualBuffer = Buffer.from(signature, "hex");

  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

function redirectAfterPayment(request, status, params = {}) {
  const redirectPath = getSafeRedirectPath(new URL(request.url).searchParams.get("redirect"));
  const redirectUrl = new URL(redirectPath, request.url);

  redirectUrl.searchParams.set("payment", status);
  if (params.razorpay_payment_id) {
    redirectUrl.searchParams.set("razorpay_payment_id", params.razorpay_payment_id);
  }
  if (params.razorpay_order_id) {
    redirectUrl.searchParams.set("razorpay_order_id", params.razorpay_order_id);
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: redirectUrl.toString(),
    },
  });
}

export async function POST(request) {
  try {
    const params = await readCallbackParams(request);
    const status = isValidRazorpaySignature(params) ? "razorpay_success" : "razorpay_failed";
    return redirectAfterPayment(request, status, params);
  } catch (error) {
    console.error("Razorpay callback error:", error);
    return redirectAfterPayment(request, "razorpay_failed");
  }
}

export async function GET(request) {
  return redirectAfterPayment(request, "razorpay_failed");
}
