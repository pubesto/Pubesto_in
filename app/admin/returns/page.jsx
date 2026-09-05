"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, X, CheckCircle, XCircle, Eye, Trash2 } from "lucide-react";

const ADMIN_PIN = "pubesto2024"; // matches process.env.ADMIN_PIN fallback

const STATUS_OPTIONS = [
  { value: "all", label: "All Returns" },
  { value: "pending", label: "Pending" },
  { value: "under_review", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "refund_initiated", label: "Refund Initiated" },
];

const REASON_MAP = {
  damaged_defective: "Damaged / Defective",
  wrong_item: "Wrong Item Delivered",
  not_as_described: "Not As Described",
  changed_mind: "Changed My Mind",
  quality_issue: "Quality Issue",
  other: "Other",
};

function formatDate(iso) {
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

function formatDateTime(iso) {
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

function StatusBadge({ status }) {
  const labels = {
    pending: "⏳ Pending",
    under_review: "🔍 Under Review",
    approved: "✅ Approved",
    rejected: "❌ Rejected",
    refund_initiated: "💰 Refund Initiated",
  };
  return (
    <span className={`returns-status-badge ${status}`}>
      {labels[status] || status}
    </span>
  );
}

// ── Admin PIN Gate ─────────────────────────────────────────
function AdminGate({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      sessionStorage.setItem("pubesto_admin_pin", pin);
      onUnlock(pin);
    } else {
      setError("Incorrect PIN. Please try again.");
      setPin("");
    }
  }

  return (
    <div className="returns-admin-gate">
      <div className="returns-admin-gate-card">
        <span className="returns-admin-gate-icon">🔐</span>
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 700,
            color: "var(--ink)",
            margin: "0 0 8px",
            fontFamily: "var(--font-display, serif)",
          }}
        >
          Admin Access Required
        </h1>
        <p style={{ fontSize: "14px", color: "var(--muted)", margin: "0 0 28px", lineHeight: 1.55 }}>
          Enter your admin PIN to access the Returns Management Dashboard.
        </p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <input
            id="admin-pin-input"
            type="password"
            className="returns-input"
            placeholder="Enter admin PIN"
            value={pin}
            onChange={(e) => { setPin(e.target.value); setError(""); }}
            autoFocus
            style={{ textAlign: "center", fontSize: "18px", letterSpacing: "0.2em" }}
          />
          {error && <p style={{ color: "#c53030", fontSize: "13px", margin: 0 }}>{error}</p>}
          <button type="submit" className="returns-btn-primary" style={{ justifyContent: "center" }} id="admin-pin-submit">
            Unlock Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Detail Modal ───────────────────────────────────────────
function ReturnDetailModal({ ret, pin, onClose, onUpdate }) {
  const [status, setStatus] = useState(ret.status);
  const [adminNotes, setAdminNotes] = useState(ret.adminNotes || "");
  const [adminInternalNotes, setAdminInternalNotes] = useState(ret.adminInternalNotes || "");
  const [rejectionReason, setRejectionReason] = useState(ret.rejectionReason || "");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [previewImg, setPreviewImg] = useState(null);

  async function handleSave() {
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch(`/api/returns/${ret.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-pin": pin,
        },
        body: JSON.stringify({ status, adminNotes, adminInternalNotes, rejectionReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMsg("Error: " + (data.error || "Failed to save."));
      } else {
        setSaveMsg("✅ Saved successfully!");
        onUpdate(data.return);
        setTimeout(() => setSaveMsg(""), 3000);
      }
    } catch {
      setSaveMsg("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function quickAction(newStatus, note) {
    setSaving(true);
    try {
      const res = await fetch(`/api/returns/${ret.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-pin": pin },
        body: JSON.stringify({
          status: newStatus,
          adminNotes: note || adminNotes,
          adminInternalNotes,
          rejectionReason: newStatus === "rejected" ? rejectionReason : "",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(newStatus);
        onUpdate(data.return);
        setSaveMsg(`✅ Marked as ${newStatus.replace("_", " ")}`);
        setTimeout(() => setSaveMsg(""), 3000);
      }
    } catch {
      setSaveMsg("Error updating status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="returns-modal-overlay" onClick={onClose}>
        <div className="returns-modal" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="returns-modal-header">
            <div>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  margin: "0 0 4px",
                }}
              >
                Return Request
              </p>
              <h2
                style={{
                  fontFamily: "monospace",
                  fontSize: "20px",
                  fontWeight: 800,
                  color: "var(--brand-color, #1b624b)",
                  margin: 0,
                  letterSpacing: "0.04em",
                }}
              >
                {ret.id}
              </h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <StatusBadge status={status} />
              <button className="returns-modal-close" onClick={onClose} aria-label="Close modal">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="returns-modal-body">
            {/* Customer Info */}
            <div className="returns-info-grid" style={{ marginBottom: "20px" }}>
              <div className="returns-info-item">
                <p className="returns-info-label">Order ID</p>
                <p className="returns-info-value">{ret.orderId}</p>
              </div>
              <div className="returns-info-item">
                <p className="returns-info-label">Customer</p>
                <p className="returns-info-value">{ret.customerName}</p>
              </div>
              <div className="returns-info-item">
                <p className="returns-info-label">Email</p>
                <p className="returns-info-value" style={{ fontSize: "12.5px", wordBreak: "break-all" }}>
                  {ret.customerEmail}
                </p>
              </div>
              <div className="returns-info-item">
                <p className="returns-info-label">Phone</p>
                <p className="returns-info-value">{ret.customerPhone || "—"}</p>
              </div>
              <div className="returns-info-item">
                <p className="returns-info-label">Product</p>
                <p className="returns-info-value">{ret.productName || "—"}</p>
              </div>
              <div className="returns-info-item">
                <p className="returns-info-label">Submitted</p>
                <p className="returns-info-value" style={{ fontSize: "12px" }}>
                  {formatDateTime(ret.submittedAt)}
                </p>
              </div>
            </div>

            {/* Reason */}
            <div style={{ marginBottom: "20px" }}>
              <p className="returns-modal-section-title">Return Reason</p>
              <div
                style={{
                  background: "var(--cream, #f8f6f2)",
                  borderRadius: "10px",
                  padding: "14px 16px",
                  border: "1px solid rgba(211,201,189,0.4)",
                }}
              >
                <p style={{ fontWeight: 700, color: "var(--ink)", margin: "0 0 4px", fontSize: "14px" }}>
                  {REASON_MAP[ret.reason] || ret.reason}
                </p>
                {ret.reasonText && (
                  <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: 1.55 }}>
                    {ret.reasonText}
                  </p>
                )}
              </div>
            </div>

            {/* Evidence Images */}
            {ret.images && ret.images.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <p className="returns-modal-section-title">Evidence Photos ({ret.images.length})</p>
                <div className="returns-modal-images">
                  {ret.images.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`Evidence ${i + 1}`}
                      className="returns-modal-img"
                      onClick={() => setPreviewImg(src)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div style={{ marginBottom: "20px" }}>
              <p className="returns-modal-section-title">Quick Actions</p>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  className="returns-action-btn approve"
                  onClick={() => quickAction("approved", "Your return has been approved. Please ship the item back within 5 business days.")}
                  disabled={saving || status === "approved"}
                >
                  <CheckCircle size={13} /> Approve Return
                </button>
                <button
                  className="returns-action-btn"
                  style={{ borderColor: "rgba(66,153,225,0.3)", color: "#2b6cb0", background: "rgba(66,153,225,0.07)" }}
                  onClick={() => quickAction("under_review")}
                  disabled={saving || status === "under_review"}
                >
                  🔍 Mark Under Review
                </button>
                <button
                  className="returns-action-btn"
                  style={{ borderColor: "rgba(100,100,200,0.3)", color: "#553c9a", background: "rgba(100,100,200,0.05)" }}
                  onClick={() => quickAction("refund_initiated", "Your refund has been initiated. Please allow 5–10 business days.")}
                  disabled={saving || status === "refund_initiated"}
                >
                  💰 Initiate Refund
                </button>
              </div>
            </div>

            {/* Status + Notes */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="returns-field">
                <label className="returns-label" htmlFor="modal-status">Update Status</label>
                <select
                  id="modal-status"
                  className="returns-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {STATUS_OPTIONS.filter((s) => s.value !== "all").map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {status === "rejected" && (
                <div className="returns-field">
                  <label className="returns-label" htmlFor="modal-rejection">
                    Rejection Reason <span style={{ color: "#e53e3e" }}>*</span>
                  </label>
                  <textarea
                    id="modal-rejection"
                    className="returns-textarea"
                    placeholder="Explain why the return was rejected (customer will see this)"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                  />
                </div>
              )}

              <div className="returns-field">
                <label className="returns-label" htmlFor="modal-admin-notes">
                  Customer-Facing Note
                </label>
                <textarea
                  id="modal-admin-notes"
                  className="returns-textarea"
                  placeholder="This note will be visible to the customer on the tracking page"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="returns-field">
                <label className="returns-label" htmlFor="modal-internal-notes">
                  Internal Notes
                </label>
                <textarea
                  id="modal-internal-notes"
                  className="returns-textarea"
                  placeholder="Internal notes — not visible to customer"
                  value={adminInternalNotes}
                  onChange={(e) => setAdminInternalNotes(e.target.value)}
                  rows={2}
                  style={{ background: "rgba(255, 248, 220, 0.5)" }}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="returns-modal-footer">
            {saveMsg && (
              <span
                style={{
                  fontSize: "13px",
                  color: saveMsg.startsWith("✅") ? "var(--brand-color)" : "#c53030",
                  fontWeight: 600,
                  flex: 1,
                }}
              >
                {saveMsg}
              </span>
            )}
            <button className="returns-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="returns-btn-primary"
              onClick={handleSave}
              disabled={saving}
              id="modal-save-btn"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      {/* Full-size image preview */}
      {previewImg && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setPreviewImg(null)}
        >
          <img
            src={previewImg}
            alt="Preview"
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: "12px", objectFit: "contain" }}
          />
          <button
            onClick={() => setPreviewImg(null)}
            style={{
              position: "fixed",
              top: "20px",
              right: "20px",
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "#fff",
              fontSize: "18px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}

// ── Main Admin Page ────────────────────────────────────────
export default function AdminReturnsPage() {
  const [pin, setPin] = useState(null);
  const [returns, setReturns] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Check session storage for persisted pin
  useEffect(() => {
    const savedPin = sessionStorage.getItem("pubesto_admin_pin");
    if (savedPin === ADMIN_PIN) {
      setPin(savedPin);
    }
  }, []);

  const fetchReturns = useCallback(
    async (currentPin) => {
      const p = currentPin || pin;
      if (!p) return;
      setLoading(true);
      setError("");
      try {
        const params = filter !== "all" ? `?status=${filter}` : "";
        const res = await fetch(`/api/returns${params}`, {
          headers: { "x-admin-pin": p },
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to load returns.");
          return;
        }
        setReturns(data);
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [pin, filter]
  );

  useEffect(() => {
    if (pin) fetchReturns();
  }, [pin, filter]);

  function handleUnlock(p) {
    setPin(p);
    fetchReturns(p);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchReturns();
    setRefreshing(false);
  }

  function handleUpdate(updated) {
    setReturns((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    if (selected?.id === updated.id) setSelected(updated);
  }

  async function handleDelete(id) {
    try {
      await fetch(`/api/returns/${id}`, {
        method: "DELETE",
        headers: { "x-admin-pin": pin },
      });
      setReturns((prev) => prev.filter((r) => r.id !== id));
      setDeleteConfirm(null);
    } catch {
      alert("Failed to delete.");
    }
  }

  // Stats
  const stats = {
    total: returns.length,
    pending: returns.filter((r) => r.status === "pending").length,
    approved: returns.filter((r) => r.status === "approved" || r.status === "refund_initiated").length,
    rejected: returns.filter((r) => r.status === "rejected").length,
  };

  if (!pin) return <AdminGate onUnlock={handleUnlock} />;

  return (
    <div className="returns-admin-page">
      <div className="returns-admin-container">
        {/* Header */}
        <div className="returns-admin-header">
          <div>
            <h1 className="returns-admin-title">Returns Management</h1>
            <p className="returns-admin-subtitle">
              Review, approve, and manage customer return requests
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              className="returns-btn-secondary"
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
                padding: "9px 16px",
              }}
            >
              <RefreshCw size={14} className={refreshing ? "spin" : ""} />
              Refresh
            </button>
            <button
              className="returns-btn-secondary"
              onClick={() => {
                sessionStorage.removeItem("pubesto_admin_pin");
                setPin(null);
              }}
              style={{ fontSize: "13px", padding: "9px 16px" }}
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="returns-stats-grid">
          {[
            { icon: "📋", value: stats.total, label: "Total Returns" },
            { icon: "⏳", value: stats.pending, label: "Pending Review" },
            { icon: "✅", value: stats.approved, label: "Approved" },
            { icon: "❌", value: stats.rejected, label: "Rejected" },
          ].map((s) => (
            <div key={s.label} className="returns-stat-card">
              <span className="returns-stat-icon">{s.icon}</span>
              <span className="returns-stat-value">{s.value}</span>
              <span className="returns-stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="returns-filter-tabs">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`returns-filter-tab${filter === opt.value ? " active" : ""}`}
              onClick={() => setFilter(opt.value)}
            >
              {opt.label}
              {opt.value !== "all" && (
                <span
                  style={{
                    marginLeft: "6px",
                    background: filter === opt.value ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.07)",
                    borderRadius: "10px",
                    padding: "1px 7px",
                    fontSize: "11px",
                  }}
                >
                  {returns.filter((r) => opt.value === "all" || r.status === opt.value).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              padding: "14px 16px",
              background: "rgba(229,62,62,0.07)",
              border: "1px solid rgba(229,62,62,0.2)",
              borderRadius: "10px",
              fontSize: "13px",
              color: "#c53030",
              marginBottom: "20px",
            }}
          >
            {error}
          </div>
        )}

        {/* Table */}
        <div className="returns-table-wrap">
          {loading ? (
            <div
              style={{
                padding: "60px",
                textAlign: "center",
                color: "var(--muted)",
                fontSize: "14px",
              }}
            >
              Loading returns…
            </div>
          ) : returns.length === 0 ? (
            <div className="returns-table-empty">
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>📭</div>
              <p style={{ fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>
                No returns found
              </p>
              <p style={{ fontSize: "13px" }}>
                {filter === "all"
                  ? "No return requests have been submitted yet."
                  : `No ${filter.replace("_", " ")} returns.`}
              </p>
            </div>
          ) : (
            <table className="returns-table">
              <thead>
                <tr>
                  <th>Return ID</th>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Reason</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <code
                        style={{
                          fontFamily: "monospace",
                          fontWeight: 700,
                          color: "var(--brand-color, #1b624b)",
                          fontSize: "13px",
                        }}
                      >
                        {r.id}
                      </code>
                    </td>
                    <td style={{ fontWeight: 600 }}>{r.orderId}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: "13px" }}>{r.customerName}</div>
                      <div style={{ fontSize: "12px", color: "var(--muted)" }}>{r.customerEmail}</div>
                    </td>
                    <td style={{ fontSize: "13px" }}>
                      {REASON_MAP[r.reason] || r.reason}
                    </td>
                    <td style={{ fontSize: "12.5px", color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {formatDate(r.submittedAt)}
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td>
                      <div className="returns-row-actions">
                        <button
                          className="returns-action-btn view"
                          onClick={() => setSelected(r)}
                          title="View details"
                        >
                          <Eye size={13} /> View
                        </button>
                        {r.status === "pending" && (
                          <button
                            className="returns-action-btn approve"
                            onClick={async () => {
                              const res = await fetch(`/api/returns/${r.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json", "x-admin-pin": pin },
                                body: JSON.stringify({
                                  status: "approved",
                                  adminNotes: "Your return has been approved. Please ship the item back within 5 business days.",
                                }),
                              });
                              const data = await res.json();
                              if (res.ok) handleUpdate(data.return);
                            }}
                            title="Quick approve"
                          >
                            <CheckCircle size={13} />
                          </button>
                        )}
                        {(r.status === "pending" || r.status === "under_review") && (
                          <button
                            className="returns-action-btn reject"
                            onClick={() => { setSelected(r); }}
                            title="Review & reject"
                          >
                            <XCircle size={13} />
                          </button>
                        )}
                        <button
                          className="returns-action-btn"
                          style={{
                            borderColor: "rgba(229,62,62,0.2)",
                            color: "#c53030",
                            background: "transparent",
                          }}
                          onClick={() => setDeleteConfirm(r.id)}
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p style={{ fontSize: "12px", color: "var(--muted)", textAlign: "center", marginTop: "20px" }}>
          Returns data is stored in-memory and resets on server restart. For production, connect a persistent database.
        </p>
      </div>

      {/* Detail Modal */}
      {selected && (
        <ReturnDetailModal
          ret={selected}
          pin={pin}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="returns-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div
            className="returns-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "400px" }}
          >
            <div className="returns-modal-header">
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink)", margin: 0 }}>
                Delete Return Request?
              </h2>
              <button className="returns-modal-close" onClick={() => setDeleteConfirm(null)}>
                <X size={14} />
              </button>
            </div>
            <div className="returns-modal-body">
              <p style={{ fontSize: "14px", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
                This will permanently delete return request{" "}
                <strong style={{ color: "var(--brand-color)", fontFamily: "monospace" }}>
                  {deleteConfirm}
                </strong>
                . This action cannot be undone.
              </p>
            </div>
            <div className="returns-modal-footer">
              <button className="returns-btn-secondary" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
              <button
                className="returns-btn-primary"
                onClick={() => handleDelete(deleteConfirm)}
                style={{ background: "#e53e3e" }}
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>
    </div>
  );
}
