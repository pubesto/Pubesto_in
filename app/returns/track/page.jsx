"use client";

import "../../returns.css";
import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search,
  RefreshCw,
  RotateCcw,
  ClipboardList,
  CheckCircle2,
  CreditCard,
  AlertTriangle,
  ShieldCheck,
  Mail,
  Clock,
  Copy,
  Check,
  Hash,
  Truck,
  Package,
  PackageX,
  Box,
  MapPin,
  ArrowUpRight,
  ChevronRight,
  ReceiptText,
  Info,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────
   Shared helpers
───────────────────────────────────────────────────────── */
function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDateShort(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

const REASON_MAP = {
  damaged_defective: "Damaged / Defective",
  wrong_item: "Wrong Item Delivered",
  not_as_described: "Not As Described",
  changed_mind: "Changed My Mind",
  quality_issue: "Quality Issue",
  other: "Other",
};

/* ─────────────────────────────────────────────────────────
   Return status config
───────────────────────────────────────────────────────── */
const RETURN_STATUS_FLOW = [
  { id: "pending", label: "Request Submitted", icon: ClipboardList, desc: "Your return request has been received and logged." },
  { id: "under_review", label: "Under Review", icon: Search, desc: "Our team is reviewing your request and supporting evidence." },
  { id: "approved", label: "Return Approved", icon: CheckCircle2, desc: "Return approved — please ship the product back within 5 days." },
  { id: "refund_initiated", label: "Refund Initiated", icon: CreditCard, desc: "Refund is processing and will reflect in 5–10 business days." },
];
const RETURN_REJECTION_FLOW = [
  { id: "pending", label: "Request Submitted", icon: ClipboardList },
  { id: "under_review", label: "Under Review", icon: Search },
  { id: "rejected", label: "Return Rejected", icon: AlertTriangle },
];

/* ─────────────────────────────────────────────────────────
   Order status config (shipping pipeline)
───────────────────────────────────────────────────────── */
const ORDER_STATUS_FLOW = [
  { id: "processing", label: "Order Placed", icon: ReceiptText, desc: "Your order has been received and payment confirmed." },
  { id: "confirmed", label: "Confirmed", icon: CheckCircle2, desc: "Your order is confirmed and being prepared." },
  { id: "shipped", label: "Shipped", icon: Truck, desc: "Your order is on the way!" },
  { id: "delivered", label: "Delivered", icon: Box, desc: "Your order has been delivered. Enjoy!" },
];

const ORDER_STATUS_STYLE = {
  processing: { color: "#b45309", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.22)" },
  confirmed:  { color: "#059669", bg: "rgba(5,150,105,0.08)", border: "rgba(5,150,105,0.2)" },
  shipped:    { color: "#2563eb", bg: "rgba(37,99,235,0.08)", border: "rgba(37,99,235,0.2)" },
  delivered:  { color: "#1b624b", bg: "rgba(27,98,75,0.08)", border: "rgba(27,98,75,0.2)" },
  cancelled:  { color: "#dc2626", bg: "rgba(220,38,38,0.06)", border: "rgba(220,38,38,0.15)" },
};

/* ─────────────────────────────────────────────────────────
   Badges
───────────────────────────────────────────────────────── */
function ReturnStatusBadge({ status }) {
  const labels = {
    pending: "⏳ Pending",
    under_review: "🔍 Under Review",
    approved: "✅ Approved",
    rejected: "❌ Rejected",
    refund_initiated: "💰 Refund Initiated",
  };
  return <span className={`returns-status-badge ${status}`}>{labels[status] || status}</span>;
}

function OrderStatusBadge({ status }) {
  const style = ORDER_STATUS_STYLE[status] || ORDER_STATUS_STYLE.processing;
  const labels = {
    processing: "⏳ Processing",
    confirmed: "✅ Confirmed",
    shipped: "🚚 Shipped",
    delivered: "📦 Delivered",
    cancelled: "❌ Cancelled",
  };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 700,
      background: style.bg, color: style.color, border: `1px solid ${style.border}`,
      textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap",
    }}>
      {labels[status] || status}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────
   Order Track View — shows shipping progress from localStorage
───────────────────────────────────────────────────────── */
function OrderTrackView({ order, onReset, copiedId, onCopy, onRefresh, refreshing }) {
  const allSteps = ORDER_STATUS_FLOW;
  const currentStepIdx = allSteps.findIndex((s) => s.id === order.status);
  const isCancelled = order.status === "cancelled";

  // Build a pseudo-timeline from the order date
  const baseDate = new Date(order.date);
  const timeline = [
    { id: "processing", date: baseDate.toISOString(), label: "Order Placed", note: "Payment confirmed and order logged in our system." },
    order.status !== "processing" && order.status !== "cancelled"
      ? { id: "confirmed", date: new Date(baseDate.getTime() + 2 * 60 * 60 * 1000).toISOString(), label: "Order Confirmed", note: "Your order is being prepared for dispatch." }
      : null,
    ["shipped", "delivered"].includes(order.status)
      ? { id: "shipped", date: new Date(baseDate.getTime() + 24 * 60 * 60 * 1000).toISOString(), label: "Dispatched", note: "Your package has been dispatched from our warehouse." }
      : null,
    order.status === "delivered"
      ? { id: "delivered", date: new Date(baseDate.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString(), label: "Delivered", note: "Package delivered successfully. We hope you love it! 🎉" }
      : null,
    isCancelled
      ? { id: "cancelled", date: new Date(baseDate.getTime() + 30 * 60 * 1000).toISOString(), label: "Cancelled", note: "This order was cancelled and a refund will be initiated if payment was made." }
      : null,
  ].filter(Boolean);

  return (
    <>
      {/* Summary Card */}
      <div className="returns-card" style={{ overflow: "hidden" }}>
        {/* Top accent */}
        <div style={{ height: "4px", background: "linear-gradient(90deg, #1b624b, #3a9d78)", margin: "-28px -28px 24px", borderRadius: "0" }} />

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
          <div>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>
              Order Tracking
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2 style={{ fontFamily: "monospace", fontSize: "22px", fontWeight: 800, color: "var(--brand-color, #1b624b)", margin: 0, letterSpacing: "0.04em" }}>
                {order.id}
              </h2>
              <button
                type="button"
                className="cancel-copy-btn"
                onClick={(e) => onCopy(order.id, e)}
                style={{ width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
              >
                {copiedId === order.id ? <Check size={14} style={{ color: "var(--brand-color)" }} /> : <Copy size={14} />}
              </button>
            </div>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: "4px 0 0" }}>
              Placed on {formatDateShort(order.date)}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <OrderStatusBadge status={order.status} />
            <button
              className="returns-btn-secondary"
              onClick={onRefresh}
              disabled={refreshing}
              style={{ padding: "6px 12px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <RefreshCw size={13} className={refreshing ? "spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* Order items */}
        {order.items?.length > 0 && (
          <div style={{ marginBottom: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {order.items.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", background: "rgba(27,98,75,0.025)", borderRadius: "10px", border: "1px solid rgba(211,201,189,0.3)" }}>
                <img
                  src={item.image}
                  alt={item.name}
                  style={{ width: "50px", height: "50px", objectFit: "cover", borderRadius: "8px", flexShrink: 0, border: "1px solid rgba(211,201,189,0.4)" }}
                  onError={(e) => { e.currentTarget.src = "/images/products/neck-fan.png"; }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--ink)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</p>
                  {item.color && <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>Colour: {item.color}</p>}
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>Qty: {item.quantity} × {item.price}</p>
                </div>
                <strong style={{ fontSize: "14px", color: "var(--ink)", flexShrink: 0 }}>
                  Rs. {((item.priceNumber || 0) * item.quantity).toLocaleString("en-IN")}
                </strong>
              </div>
            ))}
          </div>
        )}

        {/* Info grid */}
        <div className="returns-info-grid">
          <div className="returns-info-item">
            <p className="returns-info-label">Order ID</p>
            <p className="returns-info-value" style={{ fontFamily: "monospace" }}>{order.id}</p>
          </div>
          <div className="returns-info-item">
            <p className="returns-info-label">Order Total</p>
            <p className="returns-info-value" style={{ color: "var(--brand-color)", fontWeight: 800 }}>
              Rs. {order.total?.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="returns-info-item">
            <p className="returns-info-label">Payment</p>
            <p className="returns-info-value" style={{ color: "#1b624b" }}>✅ Paid</p>
          </div>
          <div className="returns-info-item">
            <p className="returns-info-label">Items</p>
            <p className="returns-info-value">{order.items?.reduce((s, i) => s + i.quantity, 0) || 1} item(s)</p>
          </div>
        </div>
      </div>

      {/* Timeline Card */}
      <div className="returns-card">
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--ink)", margin: "0 0 24px" }}>
          {isCancelled ? "Order History" : "Delivery Timeline"}
        </h3>

        {/* Visual Progress Bar (not cancelled) */}
        {!isCancelled && (
          <div style={{ display: "flex", alignItems: "center", marginBottom: "28px", gap: 0 }}>
            {allSteps.map((step, idx) => {
              const isDone = idx < currentStepIdx;
              const isActive = idx === currentStepIdx;
              const Icon = step.icon;
              return (
                <div key={step.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
                  {/* connector */}
                  {idx < allSteps.length - 1 && (
                    <div style={{ position: "absolute", top: "14px", left: "50%", width: "100%", height: "2px", background: isDone ? "#1b624b" : "rgba(211,201,189,0.5)", zIndex: 0 }} />
                  )}
                  <div style={{
                    width: "28px", height: "28px", borderRadius: "50%", zIndex: 1,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: isDone ? "#1b624b" : isActive ? "#fff" : "#f0ede8",
                    border: `2px solid ${isDone || isActive ? "#1b624b" : "rgba(211,201,189,0.6)"}`,
                    color: isDone ? "#fff" : isActive ? "#1b624b" : "var(--muted)",
                    boxShadow: isActive ? "0 0 0 4px rgba(27,98,75,0.12)" : "none",
                    transition: "all 0.2s ease",
                  }}>
                    <Icon size={13} strokeWidth={2.5} />
                  </div>
                  <span style={{ fontSize: "10px", fontWeight: 700, marginTop: "6px", textAlign: "center", color: isDone || isActive ? "#1b624b" : "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Detailed timeline entries */}
        <div className="returns-timeline">
          {timeline.map((entry) => {
            const stepCfg = ORDER_STATUS_FLOW.find((s) => s.id === entry.id);
            const Icon = stepCfg?.icon || CheckCircle2;
            const isCancelEntry = entry.id === "cancelled";
            return (
              <div key={entry.id} className="returns-timeline-item completed active">
                <div className="returns-timeline-dot" style={{
                  background: isCancelEntry ? "#dc2626" : "#1b624b",
                  borderColor: isCancelEntry ? "#dc2626" : "#1b624b",
                  color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {isCancelEntry ? <PackageX size={14} /> : <Icon size={14} />}
                </div>
                <div className="returns-timeline-content">
                  <p className="returns-timeline-label" style={{ color: isCancelEntry ? "#dc2626" : undefined }}>{entry.label}</p>
                  <p className="returns-timeline-date">{formatDate(entry.date)}</p>
                  {entry.note && <p className="returns-timeline-note">{entry.note}</p>}
                </div>
              </div>
            );
          })}
          {/* Upcoming steps */}
          {!isCancelled && allSteps.slice(currentStepIdx + 1).map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.id} className="returns-timeline-item">
                <div className="returns-timeline-dot" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "10px", color: "var(--muted)", fontWeight: "bold" }}>○</span>
                </div>
                <div className="returns-timeline-content">
                  <p className="returns-timeline-label" style={{ color: "var(--muted)" }}>{step.label}</p>
                  <p className="returns-timeline-date" style={{ fontStyle: "italic" }}>Pending…</p>
                  <p className="returns-timeline-note">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Estimated delivery notice */}
      {order.status === "shipped" && (
        <div style={{ padding: "16px 20px", background: "rgba(37,99,235,0.05)", border: "1px solid rgba(37,99,235,0.18)", borderRadius: "14px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <Truck size={20} style={{ color: "#2563eb", flexShrink: 0, marginTop: "2px" }} />
          <div>
            <p style={{ fontSize: "14px", fontWeight: 700, color: "#1d4ed8", margin: "0 0 4px" }}>Your order is on the way!</p>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: 1.55 }}>
              Estimated delivery: <strong>2–5 business days</strong>. You'll receive an update once it's delivered.
            </p>
          </div>
        </div>
      )}

      {order.status === "delivered" && (
        <div style={{ padding: "16px 20px", background: "rgba(27,98,75,0.05)", border: "1px solid rgba(27,98,75,0.18)", borderRadius: "14px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <CheckCircle2 size={20} style={{ color: "#1b624b", flexShrink: 0, marginTop: "2px" }} />
          <div>
            <p style={{ fontSize: "14px", fontWeight: 700, color: "#1b624b", margin: "0 0 4px" }}>Order delivered! 🎉</p>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: 1.55 }}>
              Not satisfied? You can submit a return/exchange request within 7 days of delivery.
            </p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {order.status === "delivered" && (
          <Link href={`/returns?orderId=${order.id}`} className="returns-btn-primary" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <RotateCcw size={15} /> Request Return / Exchange
          </Link>
        )}
        {order.status === "processing" && (
          <Link href={`/orders/cancel?orderId=${order.id}`} className="returns-btn-secondary" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <PackageX size={15} /> Cancel Order
          </Link>
        )}
        <Link href="/account?tab=orders#orders" className="returns-btn-secondary" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <Package size={15} /> View All Orders
        </Link>
        <button type="button" onClick={onReset} className="returns-btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <Search size={15} /> Track Another
        </button>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────
   Return Track View — shows return request from API
───────────────────────────────────────────────────────── */
function ReturnTrackView({ returnData, copiedId, onCopy, onRefresh, refreshing }) {
  const isRejected = returnData?.status === "rejected";
  const flow = isRejected ? RETURN_REJECTION_FLOW : RETURN_STATUS_FLOW;

  function getStepState(stepId) {
    const status = returnData.status;
    const flowIds = flow.map((f) => f.id);
    const currentIdx = flowIds.indexOf(status);
    const stepIdx = flowIds.indexOf(stepId);
    if (stepIdx < currentIdx) return "completed";
    if (stepIdx === currentIdx) return "active";
    return "upcoming";
  }

  return (
    <>
      {/* Summary Card */}
      <div className="returns-card" style={{ overflow: "hidden" }}>
        <div style={{ height: "4px", background: "linear-gradient(90deg, #2563eb, #7c3aed)", margin: "-28px -28px 24px", borderRadius: "0" }} />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
          <div>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>Return Request</p>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2 style={{ fontFamily: "monospace", fontSize: "22px", fontWeight: 800, color: "#2563eb", margin: 0, letterSpacing: "0.04em" }}>
                {returnData.id}
              </h2>
              <button type="button" className="cancel-copy-btn" onClick={(e) => onCopy(returnData.id, e)} style={{ width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                {copiedId === returnData.id ? <Check size={14} style={{ color: "#2563eb" }} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ReturnStatusBadge status={returnData.status} />
            <button className="returns-btn-secondary" onClick={onRefresh} disabled={refreshing} style={{ padding: "6px 12px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <RefreshCw size={13} className={refreshing ? "spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        <div className="returns-info-grid">
          <div className="returns-info-item">
            <p className="returns-info-label">Order ID</p>
            <p className="returns-info-value" style={{ fontFamily: "monospace" }}>{returnData.orderId}</p>
          </div>
          <div className="returns-info-item">
            <p className="returns-info-label">Customer Email</p>
            <p className="returns-info-value" style={{ fontSize: "13px" }}>{returnData.customerEmail}</p>
          </div>
          <div className="returns-info-item">
            <p className="returns-info-label">Return Reason</p>
            <p className="returns-info-value">{REASON_MAP[returnData.reason] || returnData.reason}</p>
          </div>
          <div className="returns-info-item">
            <p className="returns-info-label">Submitted On</p>
            <p className="returns-info-value" style={{ fontSize: "12.5px" }}>{formatDate(returnData.submittedAt)}</p>
          </div>
        </div>

        {returnData.adminNotes && (
          <div style={{ background: "rgba(27,98,75,0.04)", border: "1px solid rgba(27,98,75,0.15)", borderRadius: "10px", padding: "14px 16px", marginTop: "16px" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "6px" }}>Message from Pubesto</p>
            <p style={{ fontSize: "13.5px", color: "var(--ink)", margin: 0, lineHeight: 1.55 }}>{returnData.adminNotes}</p>
          </div>
        )}
        {returnData.status === "rejected" && returnData.rejectionReason && (
          <div style={{ background: "rgba(229,62,62,0.04)", border: "1px solid rgba(229,62,62,0.18)", borderRadius: "10px", padding: "14px 16px", marginTop: "16px" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#c53030", marginBottom: "6px" }}>Rejection Reason</p>
            <p style={{ fontSize: "13.5px", color: "var(--ink)", margin: 0, lineHeight: 1.55 }}>{returnData.rejectionReason}</p>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="returns-card">
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--ink)", margin: "0 0 24px" }}>Return Timeline</h3>
        <div className="returns-timeline">
          {flow.map((step) => {
            const state = getStepState(step.id);
            const timelineEntry = returnData.timeline?.find((t) => t.status === step.id);
            const isRejectedStep = step.id === "rejected";
            const Icon = step.icon;
            return (
              <div key={step.id} className={`returns-timeline-item${state === "completed" || state === "active" ? " completed" : ""}${state === "active" ? " active" : ""}${isRejectedStep && state === "active" ? " rejected" : ""}`}>
                <div className="returns-timeline-dot" style={{
                  background: isRejectedStep && state !== "upcoming" ? "#e53e3e" : undefined,
                  borderColor: isRejectedStep && state !== "upcoming" ? "#e53e3e" : undefined,
                  color: isRejectedStep && state !== "upcoming" ? "#fff" : undefined,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {state === "completed" || state === "active"
                    ? <Icon size={14} />
                    : <span style={{ fontSize: "10px", color: "var(--muted)", fontWeight: "bold" }}>○</span>
                  }
                </div>
                <div className="returns-timeline-content">
                  <p className="returns-timeline-label">{step.label}</p>
                  {timelineEntry && <p className="returns-timeline-date">{formatDate(timelineEntry.date)}</p>}
                  {timelineEntry?.note && <p className={`returns-timeline-note${isRejectedStep ? " rejected" : ""}`}>{timelineEntry.note}</p>}
                  {!timelineEntry && state === "upcoming" && <p className="returns-timeline-date" style={{ fontStyle: "italic" }}>Pending…</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <Link href="/returns" className="returns-btn-secondary" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <RotateCcw size={15} /> New Return Request
        </Link>
        <a href="mailto:support@pubesto.com" className="returns-btn-secondary" style={{ textDecoration: "none" }}>
          Contact Support
        </a>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────
   ID format detection — defined at module scope so they
   are never recreated and can safely be used in deps arrays.
───────────────────────────────────────────────────────── */
function isOrderId(id) {
  // PUB-YYYY-NNNN  (e.g. PUB-2026-7215)
  const upper = id.trim().toUpperCase();
  return upper.startsWith("PUB-") || /^PUB-\d{4}-\d{3,6}$/i.test(upper);
}
function isReturnId(id) {
  // RET-XXXXXX  (e.g. RET-847291)
  const upper = id.trim().toUpperCase();
  return upper.startsWith("RET-") || /^RET-\d{4,8}$/i.test(upper);
}

/* ─────────────────────────────────────────────────────────
   Main Track Content
───────────────────────────────────────────────────────── */
function TrackContent() {
  const searchParams = useSearchParams();
  const rawId = searchParams.get("orderId") || searchParams.get("id") || "";

  const [inputId, setInputId] = useState(rawId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState("");

  // Which mode was resolved
  const [mode, setMode] = useState(null); // "order" | "return" | null
  const [orderData, setOrderData] = useState(null);
  const [returnData, setReturnData] = useState(null);

  // Sidebar: previously tracked returns list
  const [returnsList, setReturnsList] = useState([]);
  // Sidebar: all orders from localStorage
  const [ordersList, setOrdersList] = useState([]);

  useEffect(() => {
    try {
      const ret = JSON.parse(localStorage.getItem("pubesto_returns") || "[]");
      setReturnsList(ret);
    } catch { /* ignore */ }
    try {
      const ord = JSON.parse(localStorage.getItem("pubesto_orders") || "[]");
      setOrdersList(ord.slice(0, 10)); // last 10 orders
    } catch { /* ignore */ }
  }, []);

  const lookup = useCallback(async (id) => {
    const trimmed = (id || "").trim().toUpperCase();
    if (!trimmed) {
      setError("Please enter an Order ID (e.g., PUB-2026-7215) or Return ID (e.g., RET-847291).");
      return;
    }

    setLoading(true);
    setError("");
    setMode(null);
    setOrderData(null);
    setReturnData(null);

    try {
      // ── ORDER ID (PUB-*) ──
      if (isOrderId(trimmed)) {
        const saved = JSON.parse(localStorage.getItem("pubesto_orders") || "[]");
        const found = saved.find((o) => o.id.toUpperCase() === trimmed);
        if (found) {
          setMode("order");
          setOrderData(found);
          setLoading(false);
          return;
        }

        // Try to fetch order details from Shopify dynamically
        try {
          const res = await fetch(`/api/orders/${encodeURIComponent(trimmed)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.order) {
              setMode("order");
              setOrderData(data.order);

              // Cache in localStorage
              try {
                const updated = [...saved.filter((o) => o.id.toUpperCase() !== trimmed), data.order];
                localStorage.setItem("pubesto_orders", JSON.stringify(updated));
                setOrdersList(updated.slice(0, 10));
              } catch { /* ignore */ }

              setLoading(false);
              return;
            }
          }
        } catch (e) {
          console.error("Failed to fetch order from Shopify:", e);
        }

        setError(
          `Order "${trimmed}" was not found in your account. Please check the ID — Order IDs look like PUB-2026-7215. If you just placed this order, wait a moment and try again.`
        );
        setLoading(false);
        return;
      }

      // ── RETURN ID (RET-*) → query the server API ──
      if (isReturnId(trimmed)) {
        const res = await fetch(`/api/returns?id=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (!res.ok) {
          setError(
            data.error ||
            "Return request not found. Use your Return ID (starts with RET-), not your Order ID."
          );
          return;
        }
        setMode("return");
        setReturnData(data);
        // Persist to sidebar
        try {
          const saved = JSON.parse(localStorage.getItem("pubesto_returns") || "[]");
          if (!saved.some((item) => item.id === data.id)) {
            const updated = [
              ...saved,
              {
                id: data.id,
                orderId: data.orderId,
                customerEmail: data.customerEmail,
                createdAt: data.submittedAt || new Date().toISOString(),
              },
            ];
            localStorage.setItem("pubesto_returns", JSON.stringify(updated));
            setReturnsList(updated);
          }
        } catch { /* ignore */ }
        return;
      }

      // ── Unrecognised format — check orders only (no API call) ──
      const saved = JSON.parse(localStorage.getItem("pubesto_orders") || "[]");
      const foundOrder = saved.find((o) => o.id.toUpperCase() === trimmed);
      if (foundOrder) {
        setMode("order");
        setOrderData(foundOrder);
        return;
      }

      // If unrecognised format and not in localStorage, try looking it up as a potential order
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.order) {
            setMode("order");
            setOrderData(data.order);
            return;
          }
        }
      } catch { /* ignore */ }

      setError(
        `"${trimmed}" is not a recognised ID format. Enter your Order ID (PUB-YYYY-NNNN) to track shipping, or your Return ID (RET-XXXXXX) to track a return.`
      );
    } catch (err) {
      console.error("Track lookup error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []); // no deps — reads localStorage inside, stable reference

  // Auto-lookup from URL param — runs once after mount
  useEffect(() => {
    if (rawId) lookup(rawId);
  }, [rawId, lookup]);

  async function handleRefresh() {
    if (!orderData && !returnData) return;
    setRefreshing(true);
    await lookup(orderData?.id || returnData?.id || "");
    setRefreshing(false);
  }

  function handleReset() {
    setMode(null);
    setOrderData(null);
    setReturnData(null);
    setError("");
    setInputId("");
  }

  const handleCopy = (id, e) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(""), 2000);
  };

  const hasResult = mode && (orderData || returnData);

  return (
    <main className="returns-page">
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .track-result { animation: fadeSlideIn 0.35s ease; }
        .track-type-pill {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px 12px; border-radius: 20px; font-size: 11.5px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 16px;
        }
        .track-type-pill.order { background: rgba(27,98,75,0.08); color: #1b624b; border: 1px solid rgba(27,98,75,0.2); }
        .track-type-pill.return { background: rgba(37,99,235,0.08); color: #2563eb; border: 1px solid rgba(37,99,235,0.2); }
        .sidebar-item-btn {
          display: block; width: 100%; text-align: left; padding: 12px 14px;
          border-radius: 10px; border: 1px solid rgba(211,201,189,0.45);
          background: #fff; cursor: pointer; transition: all 0.18s ease;
          margin-bottom: 8px;
        }
        .sidebar-item-btn:hover { border-color: rgba(27,98,75,0.3); background: rgba(27,98,75,0.02); }
        .sidebar-item-btn.active { border-color: #1b624b; background: rgba(27,98,75,0.04); }
      `}</style>

      <div className="returns-container">
        {/* Header */}
        <header className="returns-page-header">
          <div className="returns-badge">
            <span className="returns-badge-dot" />
            {mode === "return" ? "Return Tracker" : "Order & Return Tracker"}
          </div>
          <h1 className="returns-page-title">
            {mode === "order" ? "Order Tracking" : mode === "return" ? "Track Your Return" : "Track Your Order"}
          </h1>
          <p className="returns-page-subtitle">
            Enter your <strong>Order ID</strong> (e.g., <code style={{ fontFamily: "monospace", fontWeight: 700 }}>PUB-2026-7215</code>) to track shipping,
            or your <strong>Return ID</strong> (e.g., <code style={{ fontFamily: "monospace", fontWeight: 700 }}>RET-847291</code>) to track a return.
          </p>
        </header>

        <div className="returns-layout-grid">
          {/* ── Main Column ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>

            {/* Search bar */}
            <div className="returns-card" style={{ padding: "28px 24px" }}>
              <div className="returns-field" style={{ margin: 0 }}>
                <label className="returns-label" htmlFor="track-id-input">
                  Order ID or Return Request ID
                </label>
                <div className="returns-track-lookup" style={{ margin: 0, gap: "10px" }}>
                  <div className="cancel-input-wrapper">
                    <span className="cancel-input-icon"><Hash size={16} /></span>
                    <input
                      id="track-id-input"
                      className="returns-input"
                      type="text"
                      placeholder="e.g. PUB-2026-7215 or RET-847291"
                      value={inputId}
                      onChange={(e) => setInputId(e.target.value.toUpperCase())}
                      onKeyDown={(e) => { if (e.key === "Enter") lookup(inputId); }}
                      style={{ fontFamily: "monospace", letterSpacing: "0.04em" }}
                    />
                  </div>
                  <button
                    className="returns-btn-primary"
                    onClick={() => lookup(inputId)}
                    disabled={loading}
                    id="track-search-btn"
                    style={{ whiteSpace: "nowrap", height: "46px" }}
                  >
                    {loading
                      ? <><RefreshCw size={15} className="spin" /> Looking up…</>
                      : <><Search size={16} /> Track</>
                    }
                  </button>
                </div>

                {/* Format hints */}
                <div style={{ display: "flex", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "11.5px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Package size={12} style={{ color: "#1b624b" }} /> Order: <strong>PUB-YYYY-NNNN</strong>
                  </span>
                  <span style={{ fontSize: "11.5px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                    <RotateCcw size={12} style={{ color: "#2563eb" }} /> Return: <strong>RET-XXXXXX</strong>
                  </span>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{ padding: "12px 16px", background: "rgba(229,62,62,0.07)", border: "1px solid rgba(229,62,62,0.2)", borderRadius: "10px", fontSize: "13.5px", color: "#c53030", marginTop: "16px", lineHeight: 1.55 }}>
                  {error}
                </div>
              )}
            </div>

            {/* Results */}
            {hasResult && (
              <div className="track-result">
                {/* Mode pill */}
                <div className={`track-type-pill ${mode}`}>
                  {mode === "order"
                    ? <><Package size={13} /> Showing Order Tracking</>
                    : <><RotateCcw size={13} /> Showing Return Request</>
                  }
                </div>

                {mode === "order" && orderData && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <OrderTrackView
                      order={orderData}
                      onReset={handleReset}
                      copiedId={copiedId}
                      onCopy={handleCopy}
                      onRefresh={handleRefresh}
                      refreshing={refreshing}
                    />
                  </div>
                )}

                {mode === "return" && returnData && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <ReturnTrackView
                      returnData={returnData}
                      copiedId={copiedId}
                      onCopy={handleCopy}
                      onRefresh={handleRefresh}
                      refreshing={refreshing}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {!loading && !hasResult && !error && (
              <div className="returns-card" style={{ textAlign: "center", padding: "48px 24px", color: "var(--muted)" }}>
                <div style={{ fontSize: "52px", marginBottom: "16px" }}>📦</div>
                <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)", marginBottom: "8px" }}>Enter your ID above to start tracking</p>
                <p style={{ fontSize: "13.5px", lineHeight: 1.65, maxWidth: "380px", margin: "0 auto 24px" }}>
                  Use your <strong>Order ID</strong> to track shipping status, or your <strong>Return ID</strong> (received after submitting a return) to check its progress.
                </p>
                <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
                  <Link href="/returns" className="returns-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
                    <RotateCcw size={15} /> Submit a Return Request
                  </Link>
                  <Link href="/account?tab=orders#orders" className="returns-btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
                    <Package size={15} /> View My Orders
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <aside className="returns-sidebar">

            {/* Recent orders quick-pick */}
            {ordersList.length > 0 && (
              <div className="returns-sidebar-card">
                <h3 className="returns-sidebar-title">
                  <Package size={18} /> Recent Orders
                </h3>
                <p className="returns-sidebar-desc">Click an order to track its shipping status instantly.</p>
                {ordersList.map((o) => {
                  const isActive = orderData?.id === o.id;
                  const styleCfg = ORDER_STATUS_STYLE[o.status] || ORDER_STATUS_STYLE.processing;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      className={`sidebar-item-btn${isActive ? " active" : ""}`}
                      onClick={() => { setInputId(o.id); lookup(o.id); }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: 800, color: isActive ? "#1b624b" : "var(--ink)" }}>{o.id}</span>
                        <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "10px", background: styleCfg.bg, color: styleCfg.color, textTransform: "uppercase" }}>
                          {o.status}
                        </span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                        {o.items?.length} item(s) · {formatDateShort(o.date)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Previously tracked returns */}
            {returnsList.length > 0 && (
              <div className="returns-sidebar-card">
                <h3 className="returns-sidebar-title">
                  <ClipboardList size={18} /> Your Returns
                </h3>
                <p className="returns-sidebar-desc">Previously tracked return requests.</p>
                {returnsList.map((item) => {
                  const isSelected = returnData?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`sidebar-item-btn${isSelected ? " active" : ""}`}
                      onClick={() => { setInputId(item.id); lookup(item.id); }}
                    >
                      <div className="cancellation-item-header">
                        <span className="cancellation-item-id">{item.id}</span>
                        <span className="cancellation-item-date">
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Recent"}
                        </span>
                      </div>
                      <div className="cancellation-item-detail">Order: <strong>{item.orderId}</strong></div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Policy */}
            <div className="returns-sidebar-card">
              <h3 className="returns-sidebar-title">
                <ShieldCheck size={18} /> Policies
              </h3>
              <p className="returns-sidebar-desc">Pubesto's shipping and return commitments.</p>
              <div className="cancellation-policy-item">
                <Truck size={16} className="cancellation-policy-bullet" />
                <span className="cancellation-policy-text"><strong>Free Shipping</strong> on orders above Rs. 999.</span>
              </div>
              <div className="cancellation-policy-item">
                <ShieldCheck size={16} className="cancellation-policy-bullet" />
                <span className="cancellation-policy-text"><strong>Return Window</strong>: 7 days from delivery date.</span>
              </div>
              <div className="cancellation-policy-item">
                <Mail size={16} className="cancellation-policy-bullet" />
                <span className="cancellation-policy-text"><strong>Refund Timeline</strong>: 5–10 business days after approval.</span>
              </div>
              <div className="cancellation-policy-item">
                <Clock size={16} className="cancellation-policy-bullet" />
                <span className="cancellation-policy-text"><strong>Delivery</strong>: 3–7 business days across India.</span>
              </div>
            </div>

            {/* Help */}
            <div className="returns-sidebar-card" style={{ background: "rgba(27,98,75,0.03)", border: "1px solid rgba(27,98,75,0.1)" }}>
              <h3 className="returns-sidebar-title" style={{ color: "#1b624b" }}>
                <Info size={18} /> Need Help?
              </h3>
              <p className="returns-sidebar-desc">Our support team is here for you.</p>
              <a href="mailto:support@pubesto.com" className="returns-btn-primary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", textDecoration: "none", fontSize: "13px", padding: "10px" }}>
                <Mail size={14} /> Email Support
              </a>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function ReturnTrackPage() {
  return (
    <Suspense fallback={
      <main className="returns-page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </main>
    }>
      <TrackContent />
    </Suspense>
  );
}
