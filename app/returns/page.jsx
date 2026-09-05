"use client";

import "../returns.css";
import { useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Upload,
  RotateCcw,
  Package2,
} from "lucide-react";

const RETURN_REASONS = [
  {
    id: "damaged_defective",
    icon: "💔",
    title: "Damaged / Defective",
    desc: "Item arrived broken or has a manufacturing defect",
  },
  {
    id: "wrong_item",
    icon: "📦",
    title: "Wrong Item Delivered",
    desc: "I received a different product than what I ordered",
  },
  {
    id: "not_as_described",
    icon: "🔍",
    title: "Not As Described",
    desc: "Product looks or feels significantly different from the listing",
  },
  {
    id: "changed_mind",
    icon: "🤔",
    title: "Changed My Mind",
    desc: "I no longer need this item (unused & in original packaging)",
  },
  {
    id: "quality_issue",
    icon: "⭐",
    title: "Quality Issue",
    desc: "Product quality is below expectations",
  },
  {
    id: "other",
    icon: "📝",
    title: "Other Reason",
    desc: "Something else — I'll describe it below",
  },
];

const STEPS = ["Order Details", "Return Reason", "Upload Evidence", "Confirmation"];

function formatDate(iso) {
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

export default function ReturnsPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [returnId, setReturnId] = useState(null);
  const [apiError, setApiError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef();

  // Form state
  const [form, setForm] = useState({
    orderId: "",
    customerEmail: "",
    customerName: "",
    customerPhone: "",
    productName: "",
    reason: "",
    reasonText: "",
    images: [], // { dataUrl, name }
    agreePolicy: false,
  });

  const [errors, setErrors] = useState({});

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  }

  // ── Validation ────────────────────────────────────────────
  function validateStep(s) {
    const errs = {};

    if (s === 1) {
      if (!form.orderId.trim()) errs.orderId = "Order ID is required.";
      if (!form.customerEmail.trim()) {
        errs.customerEmail = "Email is required.";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail)) {
        errs.customerEmail = "Please enter a valid email address.";
      }
      if (!form.customerName.trim()) errs.customerName = "Name is required.";
    }

    if (s === 2) {
      if (!form.reason) errs.reason = "Please select a return reason.";
      if (form.reason === "other" && !form.reasonText.trim()) {
        errs.reasonText = "Please describe your reason.";
      }
    }

    if (s === 3) {
      if (!form.agreePolicy) {
        errs.agreePolicy = "Please confirm you have read the return policy.";
      }
    }

    return errs;
  }

  function handleNext() {
    const errs = validateStep(step);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setStep((s) => s + 1);
  }

  function handleBack() {
    setErrors({});
    setStep((s) => s - 1);
  }

  // ── Image upload ──────────────────────────────────────────
  function processFiles(files) {
    const allowed = Array.from(files).filter(
      (f) => f.type.startsWith("image/") && f.size < 5 * 1024 * 1024
    );
    if (form.images.length + allowed.length > 5) {
      setErrors((prev) => ({
        ...prev,
        images: "You can upload a maximum of 5 images.",
      }));
      return;
    }
    allowed.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setForm((prev) => ({
          ...prev,
          images: [...prev.images, { dataUrl: e.target.result, name: file.name }],
        }));
      };
      reader.readAsDataURL(file);
    });
    setErrors((prev) => ({ ...prev, images: "" }));
  }

  function removeImage(idx) {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
    }));
  }

  // ── Submit ────────────────────────────────────────────────
  async function handleSubmit() {
    const errs = validateStep(3);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    setApiError("");

    try {
      const payload = {
        orderId: form.orderId.trim(),
        customerEmail: form.customerEmail.trim(),
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        productName: form.productName.trim(),
        reason: form.reason,
        reasonText: form.reasonText.trim(),
        images: form.images.map((img) => img.dataUrl),
      };

      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.existingId) {
          setApiError(
            `A return request already exists for this order. Your Return ID is: ${data.existingId}`
          );
        } else {
          setApiError(data.error || "Failed to submit return request. Please try again.");
        }
        return;
      }

      // Save to localStorage for offline resilience
      try {
        const saved = JSON.parse(localStorage.getItem("pubesto_returns") || "[]");
        saved.push({ ...payload, id: data.returnId, status: "pending", submittedAt: new Date().toISOString() });
        localStorage.setItem("pubesto_returns", JSON.stringify(saved));
      } catch (e) {
        // non-critical
      }

      setReturnId(data.returnId);
      setStep(4);
    } catch (err) {
      setApiError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const reasonLabel = RETURN_REASONS.find((r) => r.id === form.reason)?.title || form.reason;

  // ── RENDER ────────────────────────────────────────────────
  return (
    <main className="returns-page">
      <div className="returns-container">
        {/* Header */}
        <header className="returns-page-header">
          <div className="returns-badge">
            <span className="returns-badge-dot" />
            7-Day Worry Free Returns
          </div>
          <h1 className="returns-page-title">Request a Return</h1>
          <p className="returns-page-subtitle">
            Not happy with your order? We make returns simple and hassle-free.
            Complete the form below and we'll take care of the rest.
          </p>
        </header>

        {/* Progress */}
        {step < 4 && (
          <div className="returns-progress" role="list">
            {STEPS.map((label, i) => {
              const n = i + 1;
              const isCompleted = step > n;
              const isActive = step === n;
              return (
                <div
                  key={label}
                  className={`returns-step-item${isCompleted ? " completed" : ""}${isActive ? " active" : ""}`}
                  role="listitem"
                >
                  <div className="returns-step-circle">
                    {isCompleted ? <CheckCircle2 size={15} /> : n}
                  </div>
                  <span className="returns-step-label">{label}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── STEP 1: Order Details ── */}
        {step === 1 && (
          <div className="returns-card">
            <h2 className="returns-card-title">Order Information</h2>
            <p className="returns-card-desc">
              Enter your order details exactly as they appear in your Shopify confirmation email.
            </p>

            <div className="returns-field-group">
              <div className="returns-field">
                <label className="returns-label" htmlFor="ret-order-id">
                  Order ID <span>*</span>
                </label>
                <input
                  id="ret-order-id"
                  className={`returns-input${errors.orderId ? " error" : ""}`}
                  type="text"
                  placeholder="e.g. #1234 or ORD-5678"
                  value={form.orderId}
                  onChange={(e) => setField("orderId", e.target.value)}
                />
                {errors.orderId && <span className="returns-field-error">{errors.orderId}</span>}
              </div>

              <div className="returns-field">
                <label className="returns-label" htmlFor="ret-email">
                  Email Address <span>*</span>
                </label>
                <input
                  id="ret-email"
                  className={`returns-input${errors.customerEmail ? " error" : ""}`}
                  type="email"
                  placeholder="email used at checkout"
                  value={form.customerEmail}
                  onChange={(e) => setField("customerEmail", e.target.value)}
                />
                {errors.customerEmail && (
                  <span className="returns-field-error">{errors.customerEmail}</span>
                )}
              </div>
            </div>

            <div className="returns-field-group two-col">
              <div className="returns-field">
                <label className="returns-label" htmlFor="ret-name">
                  Full Name <span>*</span>
                </label>
                <input
                  id="ret-name"
                  className={`returns-input${errors.customerName ? " error" : ""}`}
                  type="text"
                  placeholder="Your full name"
                  value={form.customerName}
                  onChange={(e) => setField("customerName", e.target.value)}
                />
                {errors.customerName && (
                  <span className="returns-field-error">{errors.customerName}</span>
                )}
              </div>

              <div className="returns-field">
                <label className="returns-label" htmlFor="ret-phone">
                  Phone Number
                </label>
                <input
                  id="ret-phone"
                  className="returns-input"
                  type="tel"
                  placeholder="+91 XXXXXXXXXX"
                  value={form.customerPhone}
                  onChange={(e) => setField("customerPhone", e.target.value)}
                />
              </div>
            </div>

            <div className="returns-field-group">
              <div className="returns-field">
                <label className="returns-label" htmlFor="ret-product">
                  Product Name
                </label>
                <input
                  id="ret-product"
                  className="returns-input"
                  type="text"
                  placeholder="e.g. Copper Water Bottle (optional)"
                  value={form.productName}
                  onChange={(e) => setField("productName", e.target.value)}
                />
              </div>
            </div>

            <div className="returns-btn-row">
              <button className="returns-btn-primary" onClick={handleNext} id="returns-next-step1">
                Continue <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Return Reason ── */}
        {step === 2 && (
          <div className="returns-card">
            <h2 className="returns-card-title">Reason for Return</h2>
            <p className="returns-card-desc">
              Tell us why you'd like to return this item so we can help you faster.
            </p>

            <div className="returns-reason-grid">
              {RETURN_REASONS.map((r) => (
                <label key={r.id} className="returns-reason-card">
                  <input
                    type="radio"
                    name="return-reason"
                    value={r.id}
                    checked={form.reason === r.id}
                    onChange={() => setField("reason", r.id)}
                  />
                  <div className="returns-reason-card-inner">
                    <span className="returns-reason-icon">{r.icon}</span>
                    <span className="returns-reason-title">{r.title}</span>
                    <span className="returns-reason-desc">{r.desc}</span>
                  </div>
                </label>
              ))}
            </div>

            {errors.reason && (
              <p className="returns-field-error" style={{ marginBottom: "16px" }}>
                {errors.reason}
              </p>
            )}

            <div className="returns-field">
              <label className="returns-label" htmlFor="ret-reason-text">
                Additional Description{form.reason === "other" ? <span> *</span> : ""}
              </label>
              <textarea
                id="ret-reason-text"
                className={`returns-textarea${errors.reasonText ? " error" : ""}`}
                placeholder="Describe the issue in more detail (size, colour, condition, etc.)"
                value={form.reasonText}
                onChange={(e) => setField("reasonText", e.target.value)}
                rows={4}
              />
              {errors.reasonText && (
                <span className="returns-field-error">{errors.reasonText}</span>
              )}
            </div>

            <div className="returns-btn-row">
              <button className="returns-btn-secondary" onClick={handleBack}>
                <ArrowLeft size={15} /> Back
              </button>
              <button className="returns-btn-primary" onClick={handleNext} id="returns-next-step2">
                Continue <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Upload Evidence ── */}
        {step === 3 && (
          <div className="returns-card">
            <h2 className="returns-card-title">Upload Evidence</h2>
            <p className="returns-card-desc">
              Photos help us process your return faster. Upload clear images of the product
              and any visible damage or defects (up to 5 images, max 5MB each).
            </p>

            <div
              className={`returns-upload-zone${dragOver ? " drag-over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                processFiles(e.dataTransfer.files);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => processFiles(e.target.files)}
              />
              <span className="returns-upload-icon">📸</span>
              <p className="returns-upload-title">Drop images here or click to upload</p>
              <p className="returns-upload-sub">PNG, JPG, WEBP · Up to 5 images · Max 5MB each</p>
            </div>

            {errors.images && (
              <p className="returns-field-error" style={{ marginBottom: "12px" }}>
                {errors.images}
              </p>
            )}

            {form.images.length > 0 && (
              <div className="returns-image-previews" style={{ marginBottom: "20px" }}>
                {form.images.map((img, i) => (
                  <div className="returns-image-preview-item" key={i}>
                    <img src={img.dataUrl} alt={img.name} />
                    <button
                      type="button"
                      className="returns-image-remove"
                      onClick={() => removeImage(i)}
                      aria-label={`Remove image ${i + 1}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Policy agreement */}
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                cursor: "pointer",
                marginBottom: "4px",
              }}
            >
              <input
                type="checkbox"
                id="ret-policy-agree"
                checked={form.agreePolicy}
                onChange={(e) => setField("agreePolicy", e.target.checked)}
                style={{ marginTop: "3px", accentColor: "var(--brand-color, #1b624b)", flexShrink: 0 }}
              />
              <span style={{ fontSize: "13px", color: "var(--ink, #1a1a1a)", lineHeight: 1.5 }}>
                I confirm the item is unused, in original packaging, and I have read and agree to
                Pubesto's{" "}
                <Link
                  href="/refund-return-policy"
                  target="_blank"
                  style={{ color: "var(--brand-color, #1b624b)", fontWeight: 600 }}
                >
                  Refund & Return Policy
                </Link>
                . Return requests must be submitted within 7 days of delivery.
              </span>
            </label>
            {errors.agreePolicy && (
              <p className="returns-field-error" style={{ marginTop: "6px", marginBottom: "4px" }}>
                {errors.agreePolicy}
              </p>
            )}

            {apiError && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "12px 16px",
                  background: "rgba(229,62,62,0.07)",
                  border: "1px solid rgba(229,62,62,0.2)",
                  borderRadius: "10px",
                  fontSize: "13px",
                  color: "#c53030",
                }}
              >
                {apiError}
              </div>
            )}

            <div className="returns-btn-row">
              <button className="returns-btn-secondary" onClick={handleBack}>
                <ArrowLeft size={15} /> Back
              </button>
              <button
                className="returns-btn-primary"
                onClick={handleSubmit}
                disabled={loading}
                id="returns-submit"
              >
                {loading ? "Submitting…" : "Submit Return Request"}
                {!loading && <ArrowRight size={16} />}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Confirmation ── */}
        {step === 4 && (
          <div className="returns-card" style={{ textAlign: "center" }}>
            <div className="returns-confirm-icon">✅</div>
            <h2 className="returns-card-title">Return Request Submitted!</h2>
            <p style={{ fontSize: "14px", color: "var(--muted, #7a7266)", marginBottom: "8px" }}>
              Your Return ID is:
            </p>
            <div className="returns-confirm-id">{returnId}</div>
            <p
              style={{
                fontSize: "13.5px",
                color: "var(--muted, #7a7266)",
                lineHeight: 1.65,
                maxWidth: "420px",
                margin: "0 auto 24px",
              }}
            >
              Save this Return ID. You'll need it to track your return status. Our team will
              review your request within <strong>1–2 business days</strong>.
            </p>

            <div className="returns-confirm-steps">
              {[
                { num: 1, text: "Our team will review your request and the evidence you provided." },
                { num: 2, text: "You'll receive an approval or rejection update on the tracking page." },
                { num: 3, text: "If approved, ship the item back within 5 business days." },
                { num: 4, text: "Refund will be processed within 5–10 business days after inspection." },
              ].map((item) => (
                <div key={item.num} className="returns-confirm-step-item">
                  <div className="returns-confirm-step-num">{item.num}</div>
                  <p className="returns-confirm-step-text">{item.text}</p>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <Link
                href={`/returns/track?id=${returnId}`}
                className="returns-btn-primary"
                id="returns-track-link"
                style={{ textDecoration: "none" }}
              >
                <RotateCcw size={16} />
                Track Return Status
              </Link>
              <Link
                href="/shop"
                className="returns-btn-secondary"
                style={{ textDecoration: "none" }}
              >
                Continue Shopping
              </Link>
            </div>

            <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "24px" }}>
              Need help?{" "}
              <a
                href="mailto:support@pubesto.com"
                style={{ color: "var(--brand-color, #1b624b)", fontWeight: 600 }}
              >
                support@pubesto.com
              </a>{" "}
              · +91 7056063693
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
