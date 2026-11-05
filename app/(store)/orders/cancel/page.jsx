"use client";

import "../../returns.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  PackageX, 
  Clock, 
  AlertTriangle, 
  ShieldCheck, 
  Mail, 
  HelpCircle, 
  RefreshCw, 
  ClipboardList, 
  Info, 
  Copy, 
  Check, 
  Hash, 
  User, 
  Phone, 
  ShoppingBag, 
  CreditCard, 
  Search,
  MessageSquare
} from "lucide-react";

const CANCELLATION_REASONS = [
  { id: "ordered_by_mistake", label: "Ordered by Mistake", desc: "Selected incorrect items or duplicate checkout.", icon: PackageX },
  { id: "wrong_product", label: "Wrong Item/Variant", desc: "Selected wrong size, color, or option.", icon: RefreshCw },
  { id: "delivery_timing", label: "Timing Issue", desc: "Delivery estimate is too slow for my timeline.", icon: Clock },
  { id: "found_alternative", label: "Found Better Option", desc: "Purchased a better alternative or lower price.", icon: Search },
  { id: "payment_issue", label: "Payment / Billing", desc: "Double transaction or checkout billing failure.", icon: CreditCard },
  { id: "other", label: "Other Reason", desc: "Any custom reason (explain in detail below).", icon: ClipboardList },
];

const EMPTY_FORM = {
  orderId: "",
  customerEmail: "",
  customerName: "",
  customerPhone: "",
  productName: "",
  reason: "",
  reasonText: "",
  agreePolicy: false,
};

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

export default function CancelOrderPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [cancellationId, setCancellationId] = useState("");

  // Real-time cancellation tracking states
  const [cancellationsList, setCancellationsList] = useState([]);
  const [selectedCancellation, setSelectedCancellation] = useState(null);
  const [fetchingStatus, setFetchingStatus] = useState(false);
  const [fetchError, setFetchError] = useState("");

  // Copy status
  const [copiedId, setCopiedId] = useState("");

  useEffect(() => {
    async function prefillAccount() {
      try {
        const response = await fetch("/api/account", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        const user = data.user;
        if (!user) return;

        setForm((current) => ({
          ...current,
          customerName: current.customerName || user.name || "",
          customerEmail: current.customerEmail || user.email || "",
          customerPhone: current.customerPhone || user.phone || "",
        }));
      } catch {
        // The form remains usable for guests.
      }
    }

    prefillAccount();

    try {
      const params = new URLSearchParams(window.location.search);
      const qOrderId = params.get("orderId");
      if (qOrderId) {
        setForm((current) => ({ ...current, orderId: qOrderId }));
      }
    } catch {
      // Optional
    }

    try {
      const saved = JSON.parse(localStorage.getItem("pubesto_cancellations") || "[]");
      setCancellationsList(saved);
    } catch {
      // Optional
    }
  }, []);

  async function fetchCancellationStatus(id) {
    setFetchingStatus(true);
    setFetchError("");
    setSelectedCancellation(null);
    try {
      const response = await fetch(`/api/order-cancellations?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setFetchError(data.error || "Could not retrieve cancellation status.");
        return;
      }
      setSelectedCancellation(data);
    } catch {
      setFetchError("Network error. Please try again.");
    } finally {
      setFetchingStatus(false);
    }
  }

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setApiError("");
  }

  const handleCopy = (id, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(""), 2000);
  };

  function validateForm() {
    const nextErrors = {};

    if (!form.orderId.trim()) nextErrors.orderId = "Order ID is required.";
    if (!form.customerName.trim()) nextErrors.customerName = "Full name is required.";
    if (!isValidEmail(form.customerEmail)) nextErrors.customerEmail = "Enter a valid checkout email.";
    if (!form.reason) nextErrors.reason = "Select a cancellation reason.";
    if (form.reason === "other" && !form.reasonText.trim()) {
      nextErrors.reasonText = "Please describe why you want to cancel.";
    }
    if (!form.agreePolicy) {
      nextErrors.agreePolicy = "Confirm that you understand cancellation depends on dispatch status.";
    }

    return nextErrors;
  }

  async function submitCancellation(event) {
    event.preventDefault();
    const nextErrors = validateForm();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setLoading(true);
    setApiError("");

    const payload = {
      orderId: form.orderId.trim(),
      customerEmail: form.customerEmail.trim(),
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim(),
      productName: form.productName.trim(),
      reason: form.reason,
      reasonText: form.reasonText.trim(),
    };

    try {
      const response = await fetch("/api/order-cancellations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409 && data.existingId) {
          setApiError(`A cancellation request already exists. Request ID: ${data.existingId}`);
        } else {
          setApiError(data.error || "Could not submit cancellation request.");
        }
        return;
      }

      setCancellationId(data.cancellationId);
      try {
        const saved = JSON.parse(localStorage.getItem("pubesto_cancellations") || "[]");
        const newRecord = { ...payload, id: data.cancellationId, status: "requested", createdAt: new Date().toISOString() };
        saved.push(newRecord);
        localStorage.setItem("pubesto_cancellations", JSON.stringify(saved));
        setCancellationsList(saved);
      } catch {
        // Local backup is optional.
      }
    } catch {
      setApiError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (cancellationId) {
    return (
      <main className="returns-page">
        <div className="returns-container">
          <div className="returns-card" style={{ textAlign: "center", position: "relative" }}>
            <div className="returns-confirm-icon">
              <CheckCircle2 size={34} />
            </div>
            <h1 className="returns-card-title">Order Cancelled Successfully</h1>
            <p style={{ fontSize: "14px", color: "var(--muted, #7a7266)", marginBottom: "8px" }}>
              Your cancellation request ID is:
            </p>
            
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", margin: "8px 0 20px" }}>
              <div className="returns-confirm-id" style={{ margin: 0 }}>{cancellationId}</div>
              <button 
                type="button" 
                className="cancel-copy-btn" 
                onClick={(e) => handleCopy(cancellationId, e)}
                style={{ height: "32px", width: "32px", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
              >
                {copiedId === cancellationId ? <Check size={16} style={{ color: "var(--brand-color)" }} /> : <Copy size={16} />}
              </button>
            </div>

            <p
              style={{
                fontSize: "13.5px",
                color: "var(--muted, #7a7266)",
                lineHeight: 1.65,
                maxWidth: "440px",
                margin: "0 auto 24px",
              }}
            >
              Your order has been successfully cancelled in our system.
              If you paid online, a full refund has been initiated and will reflect in your original payment method within 5-7 business days.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/account" className="returns-btn-primary" style={{ textDecoration: "none" }}>
                Back to Account
              </Link>
              <Link href="/shop" className="returns-btn-secondary" style={{ textDecoration: "none" }}>
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="returns-page">
      <div className="returns-container">
        <header className="returns-page-header">
          <div className="returns-badge">
            <span className="returns-badge-dot" />
            Before Dispatch
          </div>
          <h1 className="returns-page-title">Cancel an Order</h1>
          <p className="returns-page-subtitle">
            Submit your cancellation request with the order details from your confirmation email.
            Eligible unfulfilled orders will be cancelled instantly and refunds initiated automatically.
          </p>
        </header>

        <div className="returns-layout-grid">
          <form className="returns-card" onSubmit={submitCancellation}>
            <div className="account-card-header" style={{ marginBottom: "24px" }}>
              <PackageX size={24} style={{ color: "var(--brand-color)" }} />
              <div>
                <h2 className="returns-card-title">Order Details</h2>
                <p className="returns-card-desc" style={{ margin: "4px 0 0" }}>
                  Cancellations are available only before the order has shipped.
                </p>
              </div>
            </div>

            {/* Order ID */}
            <div className="returns-field-group">
              <div className="returns-field">
                <label className="returns-label" htmlFor="cancel-order-id">
                  Order ID <span>*</span>
                </label>
                <div className="cancel-input-wrapper">
                  <span className="cancel-input-icon">
                    <Hash size={16} />
                  </span>
                  <input
                    id="cancel-order-id"
                    className={`returns-input${errors.orderId ? " error" : ""}`}
                    type="text"
                    placeholder="e.g. #1234 or ORD-5678"
                    value={form.orderId}
                    onChange={(event) => setField("orderId", event.target.value)}
                  />
                  {form.orderId.trim() && !errors.orderId && (
                    <span className="cancel-field-success-icon">
                      <CheckCircle2 size={16} />
                    </span>
                  )}
                </div>
                {errors.orderId ? <span className="returns-field-error">{errors.orderId}</span> : null}
              </div>
            </div>

            {/* Name and Email */}
            <div className="returns-field-group two-col">
              <div className="returns-field">
                <label className="returns-label" htmlFor="cancel-name">
                  Full Name <span>*</span>
                </label>
                <div className="cancel-input-wrapper">
                  <span className="cancel-input-icon">
                    <User size={16} />
                  </span>
                  <input
                    id="cancel-name"
                    className={`returns-input${errors.customerName ? " error" : ""}`}
                    type="text"
                    value={form.customerName}
                    onChange={(event) => setField("customerName", event.target.value)}
                  />
                  {form.customerName.trim() && !errors.customerName && (
                    <span className="cancel-field-success-icon">
                      <CheckCircle2 size={16} />
                    </span>
                  )}
                </div>
                {errors.customerName ? <span className="returns-field-error">{errors.customerName}</span> : null}
              </div>

              <div className="returns-field">
                <label className="returns-label" htmlFor="cancel-email">
                  Checkout Email <span>*</span>
                </label>
                <div className="cancel-input-wrapper">
                  <span className="cancel-input-icon">
                    <Mail size={16} />
                  </span>
                  <input
                    id="cancel-email"
                    className={`returns-input${errors.customerEmail ? " error" : ""}`}
                    type="email"
                    value={form.customerEmail}
                    onChange={(event) => setField("customerEmail", event.target.value)}
                  />
                  {isValidEmail(form.customerEmail) && !errors.customerEmail && (
                    <span className="cancel-field-success-icon">
                      <CheckCircle2 size={16} />
                    </span>
                  )}
                </div>
                {errors.customerEmail ? <span className="returns-field-error">{errors.customerEmail}</span> : null}
              </div>
            </div>

            {/* Phone and Product */}
            <div className="returns-field-group two-col">
              <div className="returns-field">
                <label className="returns-label" htmlFor="cancel-phone">
                  Phone Number
                </label>
                <div className="cancel-input-wrapper">
                  <span className="cancel-input-icon">
                    <Phone size={16} />
                  </span>
                  <input
                    id="cancel-phone"
                    className="returns-input"
                    type="tel"
                    placeholder="+91 XXXXXXXXXX"
                    value={form.customerPhone}
                    onChange={(event) => setField("customerPhone", event.target.value)}
                  />
                  {form.customerPhone.trim() && (
                    <span className="cancel-field-success-icon">
                      <CheckCircle2 size={16} />
                    </span>
                  )}
                </div>
              </div>

              <div className="returns-field">
                <label className="returns-label" htmlFor="cancel-product">
                  Product Name
                </label>
                <div className="cancel-input-wrapper">
                  <span className="cancel-input-icon">
                    <ShoppingBag size={16} />
                  </span>
                  <input
                    id="cancel-product"
                    className="returns-input"
                    type="text"
                    placeholder="Optional"
                    value={form.productName}
                    onChange={(event) => setField("productName", event.target.value)}
                  />
                  {form.productName.trim() && (
                    <span className="cancel-field-success-icon">
                      <CheckCircle2 size={16} />
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Cancellation Reason Selector */}
            <div className="returns-field" style={{ marginBottom: "20px" }}>
              <label className="returns-label">
                Cancellation Reason <span>*</span>
              </label>
              
              <div className="cancel-reason-grid">
                {CANCELLATION_REASONS.map((item) => {
                  const Icon = item.icon;
                  const isSelected = form.reason === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`cancel-reason-card ${isSelected ? "selected" : ""}`}
                      onClick={() => setField("reason", item.id)}
                    >
                      <div className="cancel-reason-icon-wrapper">
                        <Icon size={18} />
                      </div>
                      {isSelected && (
                        <span className="cancel-reason-check">
                          <CheckCircle2 size={16} />
                        </span>
                      )}
                      <h4 className="cancel-reason-card-title">{item.label}</h4>
                      <p className="cancel-reason-card-desc">{item.desc}</p>
                    </button>
                  );
                })}
              </div>
              {errors.reason ? <span className="returns-field-error" style={{ marginTop: "-12px", marginBottom: "16px", display: "block" }}>{errors.reason}</span> : null}
            </div>

            {/* Additional Details */}
            <div className="returns-field" style={{ gap: "8px" }}>
              <label className="returns-label" htmlFor="cancel-notes">
                Additional Details{form.reason === "other" ? <span> *</span> : null}
              </label>
              <div className="cancel-input-wrapper">
                <span className="cancel-input-icon" style={{ top: "16px", alignSelf: "flex-start" }}>
                  <MessageSquare size={16} />
                </span>
                <textarea
                  id="cancel-notes"
                  className={`returns-textarea${errors.reasonText ? " error" : ""}`}
                  rows={4}
                  style={{ paddingLeft: "42px" }}
                  placeholder="Add any details that can help our verification team locate the dispatch record."
                  value={form.reasonText}
                  onChange={(event) => setField("reasonText", event.target.value)}
                />
              </div>
              {errors.reasonText ? <span className="returns-field-error">{errors.reasonText}</span> : null}
            </div>

            {/* Custom Checkbox Wrapper */}
            <div 
              className={`cancel-checkbox-wrapper ${form.agreePolicy ? "checked" : ""}`}
              onClick={() => setField("agreePolicy", !form.agreePolicy)}
            >
              <div className="cancel-checkbox-box">
                {form.agreePolicy && <Check size={12} strokeWidth={3} />}
              </div>
              <span className="cancel-checkbox-label">
                I understand cancellation is confirmed only if the order has not been dispatched.
              </span>
            </div>
            {errors.agreePolicy ? <p className="returns-field-error" style={{ marginTop: 0, marginBottom: "16px" }}>{errors.agreePolicy}</p> : null}

            {apiError ? (
              <div className="returns-inline-error">
                {apiError}
              </div>
            ) : null}

            <div className="returns-btn-row">
              <Link href="/account" className="returns-btn-secondary" style={{ textDecoration: "none" }}>
                <ArrowLeft size={15} /> Back
              </Link>
              <button className="returns-btn-primary" type="submit" disabled={loading}>
                {loading ? "Submitting..." : "Submit Cancellation"}
                {!loading ? <ArrowRight size={16} /> : null}
              </button>
            </div>
          </form>

          {/* Sidebar */}
          <aside className="returns-sidebar">
            {cancellationsList.length > 0 && (
              <div className="returns-sidebar-card">
                <h3 className="returns-sidebar-title">
                  <ClipboardList size={18} />
                  Your Requests
                </h3>
                <p className="returns-sidebar-desc">
                  Select a submitted request to track its real-time processing status directly from our server.
                </p>
                
                <div className="cancellations-list">
                  {cancellationsList.map((item) => {
                    const isSelected = selectedCancellation?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        className={`cancellation-item-btn ${isSelected ? "selected" : ""}`}
                        type="button"
                        onClick={() => fetchCancellationStatus(item.id)}
                      >
                        <div className="cancellation-item-header">
                          <span className="cancellation-item-id">{item.id}</span>
                          <span className="cancellation-item-date">
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Recent"}
                          </span>
                        </div>
                        <div className="cancellation-item-detail">
                          Order ID: <strong>{item.orderId}</strong>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dynamic Status Detail Card */}
            {(selectedCancellation || fetchingStatus || fetchError) && (
              <div className="cancellation-detail-view" style={{ overflow: "hidden" }}>
                <div className="cancellation-detail-header">
                  <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Info size={14} style={{ color: "var(--brand-color)" }} />
                    Request Tracking
                  </h4>
                  <button 
                    className="cancellation-detail-close" 
                    type="button"
                    onClick={() => setSelectedCancellation(null)}
                  >
                    Close
                  </button>
                </div>

                {fetchingStatus && <p style={{ fontSize: "12px", color: "var(--muted)", margin: "8px 0" }}>Loading real-time status...</p>}
                
                {fetchError && <p style={{ fontSize: "12px", color: "#c53030", margin: "8px 0" }}>{fetchError}</p>}

                {selectedCancellation && !fetchingStatus && (
                  <div>
                    <div className="cancellation-detail-grid">
                      <div className="cancellation-detail-item">
                        <p className="cancellation-detail-label">Status</p>
                        <p className="cancellation-detail-val" style={{ color: selectedCancellation.status === "rejected" ? "#c53030" : "var(--brand-color)" }}>
                          {selectedCancellation.status === "requested" ? "⏳ Requested" : selectedCancellation.status === "approved" ? "✅ Approved" : "❌ Rejected"}
                        </p>
                      </div>
                      <div className="cancellation-detail-item">
                        <p className="cancellation-detail-label">Order ID</p>
                        <p className="cancellation-detail-val">{selectedCancellation.orderId}</p>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "8px 10px", background: "#ffffff", border: "1px solid rgba(211,201,189,0.4)", borderRadius: "8px", marginBottom: "16px" }}>
                      <div style={{ flex: 1 }}>
                        <span className="cancellation-detail-label" style={{ display: "block" }}>Request ID</span>
                        <span className="cancellation-item-id" style={{ fontSize: "13px" }}>{selectedCancellation.id}</span>
                      </div>
                      <button 
                        type="button" 
                        className="cancel-copy-btn" 
                        onClick={(e) => handleCopy(selectedCancellation.id, e)}
                        style={{ height: "26px", width: "26px", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                      >
                        {copiedId === selectedCancellation.id ? <Check size={14} style={{ color: "var(--brand-color)" }} /> : <Copy size={14} />}
                      </button>
                    </div>

                    {/* Timeline stepper */}
                    {selectedCancellation.timeline && selectedCancellation.timeline.length > 0 && (
                      <div style={{ background: "#ffffff", padding: "14px", borderRadius: "10px", border: "1px solid rgba(211,201,189,0.4)" }}>
                        <h5 style={{ margin: "0 0 12px 0", fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
                          Verification Stepper
                        </h5>

                        <div className="cancel-tracker-timeline">
                          {selectedCancellation.timeline.map((step, idx) => {
                            const isLast = idx === selectedCancellation.timeline.length - 1;
                            const isCompleted = step.status === "approved" || step.status === "completed";
                            const isRejected = step.status === "rejected";
                            const isCurrent = isLast && !isCompleted && !isRejected;

                            let statusClass = "completed";
                            if (isRejected) {
                              statusClass = "rejected";
                            } else if (isCurrent) {
                              statusClass = "active";
                            }

                            return (
                              <div key={idx} className={`cancel-tracker-step ${statusClass}`}>
                                <div className="cancel-tracker-node" />
                                <div className="cancel-tracker-content">
                                  <div className="cancel-tracker-title">{step.label}</div>
                                  {step.date && (
                                    <div className="cancel-tracker-date">
                                      {new Date(step.date).toLocaleString("en-IN", {
                                        day: "numeric",
                                        month: "short",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </div>
                                  )}
                                  {step.note && <div className="cancel-tracker-note">{step.note}</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="returns-sidebar-card">
              <h3 className="returns-sidebar-title">
                <ShieldCheck size={18} />
                Cancellation Policy
              </h3>
              <p className="returns-sidebar-desc">
                Cancellations are automatically verified against real-time dispatch tracking.
              </p>
              <div className="cancellation-policy-item">
                <ShieldCheck size={16} className="cancellation-policy-bullet" />
                <span className="cancellation-policy-text">
                  <strong>Before Dispatch Only</strong>: Requests submitted post-dispatch cannot be cancelled.
                </span>
              </div>
              <div className="cancellation-policy-item">
                <Clock size={16} className="cancellation-policy-bullet" />
                <span className="cancellation-policy-text">
                  <strong>Prepaid Refunds</strong>: Reimbursed automatically to the source account in 5-7 days.
                </span>
              </div>
              <div className="cancellation-policy-item">
                <Mail size={16} className="cancellation-policy-bullet" />
                <span className="cancellation-policy-text">
                  <strong>Support Hours</strong>: Mon - Sat (10 AM - 7 PM) at support@pubesto.com.
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
