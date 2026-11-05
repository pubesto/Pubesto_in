import "server-only";

import { mediaUrl } from "@/lib/server/media";

/** Public view: status and timeline only, no contact details or internal notes. */
export function publicReturnView(row) {
  return {
    id: row.id,
    orderId: row.orderRef,
    productName: row.productName,
    reason: row.reason,
    reasonText: row.reasonText,
    images: (row.images || []).map((key) => mediaUrl(key) || key),
    status: row.status,
    adminNotes: row.adminNotes,
    rejectionReason: row.rejectionReason,
    submittedAt: row.createdAt,
    updatedAt: row.updatedAt,
    timeline: row.timeline,
  };
}
