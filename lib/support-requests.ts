/**
 * Status catalogue for return and cancellation requests. Shared by the
 * dashboard UI and the server actions so timeline labels stay consistent with
 * what the storefront tracking pages show.
 */

export const RETURN_STATUSES = ["pending", "under_review", "approved", "rejected", "refund_initiated"] as const
export type ReturnStatus = (typeof RETURN_STATUSES)[number]

export const RETURN_STATUS_NAMES: Record<ReturnStatus, string> = {
  pending: "Pending",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  refund_initiated: "Refund initiated",
}

/** Timeline labels, as the customer sees them. */
export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  pending: "Return Request Submitted",
  under_review: "Under Review",
  approved: "Return Approved",
  rejected: "Return Rejected",
  refund_initiated: "Refund Initiated",
}

/** Default customer-facing timeline note when the admin leaves it blank. */
export const RETURN_STATUS_NOTES: Record<ReturnStatus, string> = {
  pending: "Your return request has been received. We'll review it within 1–2 business days.",
  under_review: "Our team is reviewing your return request and the provided evidence.",
  approved: "Your return has been approved. Please ship the product back within 5 business days.",
  rejected: "Unfortunately, your return request could not be approved at this time.",
  refund_initiated: "Your refund has been initiated and will reflect in 5–10 business days.",
}

export const CANCELLATION_STATUSES = ["requested", "approved", "rejected"] as const
export type CancellationStatus = (typeof CANCELLATION_STATUSES)[number]

export const CANCELLATION_STATUS_NAMES: Record<CancellationStatus, string> = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Rejected",
}

export const CANCELLATION_STATUS_LABELS: Record<CancellationStatus, string> = {
  requested: "Cancellation Request Submitted",
  approved: "Order Cancelled Successfully",
  rejected: "Cancellation Rejected",
}

export const CANCELLATION_STATUS_NOTES: Record<CancellationStatus, string> = {
  requested: "Your cancellation request has been received.",
  approved: "Your order has been cancelled.",
  rejected: "Unfortunately, your cancellation request could not be approved.",
}

export function returnStatusName(status: string) {
  return RETURN_STATUS_NAMES[status as ReturnStatus] ?? status
}

export function cancellationStatusName(status: string) {
  return CANCELLATION_STATUS_NAMES[status as CancellationStatus] ?? status
}
