"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Eye,
  EyeOff,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Star,
  Trash2,
  X,
} from "lucide-react";

const ADMIN_PIN = "pubesto2024";

const EMPTY_FORM = {
  customerName: "",
  customerImage: "",
  rating: 5,
  text: "",
  productSlug: "",
  productName: "",
  showOnHomepage: true,
  isPublished: true,
  sortOrder: 100,
};

function getInitials(name) {
  return String(name || "Customer")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "C";
}

function formatDate(iso) {
  if (!iso) return "Never";
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

function AdminGate({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    if (pin === ADMIN_PIN) {
      sessionStorage.setItem("pubesto_admin_pin", pin);
      onUnlock(pin);
      return;
    }

    setError("Incorrect PIN. Please try again.");
    setPin("");
  }

  return (
    <div className="returns-admin-gate">
      <div className="returns-admin-gate-card">
        <span className="review-admin-lock">
          <Lock size={30} />
        </span>
        <h1 className="returns-admin-title" style={{ textAlign: "center" }}>
          Admin Access Required
        </h1>
        <p className="returns-admin-subtitle" style={{ textAlign: "center", marginBottom: "24px" }}>
          Enter your admin PIN to manage customer reviews.
        </p>
        <form onSubmit={handleSubmit} className="review-admin-gate-form">
          <input
            id="admin-pin-input"
            type="password"
            className="returns-input"
            placeholder="Enter admin PIN"
            value={pin}
            onChange={(event) => {
              setPin(event.target.value);
              setError("");
            }}
            autoFocus
          />
          {error ? <p className="returns-field-error">{error}</p> : null}
          <button type="submit" className="returns-btn-primary" id="admin-pin-submit">
            Unlock Reviews
          </button>
        </form>
      </div>
    </div>
  );
}

function RatingStars({ rating }) {
  const rounded = Math.round(Number(rating) || 0);
  return (
    <span className="review-admin-stars" aria-label={`${rounded} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((index) => (
        <Star
          key={index}
          size={14}
          fill={index < rounded ? "currentColor" : "none"}
          strokeWidth={2}
        />
      ))}
    </span>
  );
}

export default function ReviewsAdminPage() {
  const [pin, setPin] = useState("");
  const [reviews, setReviews] = useState([]);
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadReviews = useCallback(async (activePin) => {
    if (!activePin) return;
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/reviews", {
        headers: { "x-admin-pin": activePin },
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Failed to load reviews.");
        return;
      }

      setReviews(data.reviews || []);
    } catch {
      setMessage("Network error while loading reviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedPin = sessionStorage.getItem("pubesto_admin_pin");
    if (savedPin === ADMIN_PIN) {
      setPin(savedPin);
      loadReviews(savedPin);
    }
  }, [loadReviews]);

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch("/api/products", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        setProducts(Array.isArray(data) ? data : []);
      } catch {
        setProducts([]);
      }
    }

    if (pin) loadProducts();
  }, [pin]);

  const filteredReviews = useMemo(() => {
    if (filter === "published") return reviews.filter((review) => review.isPublished);
    if (filter === "draft") return reviews.filter((review) => !review.isPublished);
    if (filter === "homepage") return reviews.filter((review) => review.showOnHomepage);
    if (filter === "product") return reviews.filter((review) => review.productSlug);
    return reviews;
  }, [filter, reviews]);

  const stats = useMemo(() => {
    const published = reviews.filter((review) => review.isPublished);
    const average = published.length
      ? published.reduce((sum, review) => sum + Number(review.rating || 0), 0) / published.length
      : 0;

    return {
      total: reviews.length,
      published: published.length,
      homepage: reviews.filter((review) => review.showOnHomepage).length,
      average: Math.round(average * 10) / 10,
    };
  }, [reviews]);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleProductChange(productSlug) {
    const product = products.find((item) => item.slug === productSlug);
    setForm((current) => ({
      ...current,
      productSlug,
      productName: product?.name || current.productName,
    }));
  }

  function startEdit(review) {
    setEditingId(review.id);
    setForm({
      customerName: review.customerName || "",
      customerImage: review.customerImage || "",
      rating: review.rating || 5,
      text: review.text || "",
      productSlug: review.productSlug || "",
      productName: review.productName || "",
      showOnHomepage: Boolean(review.showOnHomepage),
      isPublished: review.isPublished !== false,
      sortOrder: Number(review.sortOrder || 100),
    });
    setMessage("");
    document.getElementById("review-admin-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const endpoint = editingId ? `/api/reviews/${editingId}` : "/api/reviews";
      const response = await fetch(endpoint, {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-pin": pin,
        },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Failed to save review.");
        return;
      }

      setMessage(editingId ? "Review updated." : "Review added.");
      resetForm();
      await loadReviews(pin);
    } catch {
      setMessage("Network error while saving review.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(review) {
    if (!window.confirm(`Delete the review from ${review.customerName}?`)) return;

    setMessage("");
    try {
      const response = await fetch(`/api/reviews/${review.id}`, {
        method: "DELETE",
        headers: { "x-admin-pin": pin },
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Failed to delete review.");
        return;
      }

      setReviews((current) => current.filter((item) => item.id !== review.id));
      setMessage("Review deleted.");
    } catch {
      setMessage("Network error while deleting review.");
    }
  }

  async function togglePublished(review) {
    try {
      const response = await fetch(`/api/reviews/${review.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-pin": pin,
        },
        body: JSON.stringify({ isPublished: !review.isPublished }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Failed to update review.");
        return;
      }
      setReviews((current) => current.map((item) => (item.id === review.id ? data.review : item)));
    } catch {
      setMessage("Network error while updating review.");
    }
  }

  if (!pin) {
    return <AdminGate onUnlock={(nextPin) => { setPin(nextPin); loadReviews(nextPin); }} />;
  }

  return (
    <main className="returns-admin-page">
      <div className="returns-admin-container">
        <header className="returns-admin-header">
          <div>
            <h1 className="returns-admin-title">Reviews Management</h1>
            <p className="returns-admin-subtitle">
              Add, edit, publish, and assign customer reviews to products or the homepage.
            </p>
          </div>
          <button
            type="button"
            className="returns-btn-secondary review-admin-refresh"
            onClick={() => loadReviews(pin)}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? "review-admin-spin" : ""} />
            Refresh
          </button>
        </header>

        <section className="returns-stats-grid" aria-label="Reviews summary">
          <div className="returns-stat-card">
            <span className="returns-stat-label">Total Reviews</span>
            <strong className="returns-stat-value">{stats.total}</strong>
          </div>
          <div className="returns-stat-card">
            <span className="returns-stat-label">Published</span>
            <strong className="returns-stat-value">{stats.published}</strong>
          </div>
          <div className="returns-stat-card">
            <span className="returns-stat-label">Homepage</span>
            <strong className="returns-stat-value">{stats.homepage}</strong>
          </div>
          <div className="returns-stat-card">
            <span className="returns-stat-label">Average Rating</span>
            <strong className="returns-stat-value">{stats.average || "-"}</strong>
          </div>
        </section>

        <section className="review-admin-form-card" id="review-admin-form">
          <div className="review-admin-form-header">
            <div>
              <h2>{editingId ? "Edit Review" : "Add Review"}</h2>
              <p>Use image URLs for customer avatars. Leave product blank for a homepage-only review.</p>
            </div>
            {editingId ? (
              <button type="button" className="returns-btn-secondary" onClick={resetForm}>
                <X size={16} />
                Cancel Edit
              </button>
            ) : null}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="review-admin-form-grid">
              <label className="returns-field">
                <span className="returns-label">Customer Name</span>
                <input
                  className="returns-input"
                  value={form.customerName}
                  onChange={(event) => setField("customerName", event.target.value)}
                  placeholder="Customer name"
                  required
                />
              </label>

              <label className="returns-field">
                <span className="returns-label">Rating</span>
                <select
                  className="returns-select"
                  value={form.rating}
                  onChange={(event) => setField("rating", Number(event.target.value))}
                >
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <option key={rating} value={rating}>
                      {rating} out of 5
                    </option>
                  ))}
                </select>
              </label>

              <label className="returns-field">
                <span className="returns-label">Product</span>
                {products.length > 0 ? (
                  <select
                    className="returns-select"
                    value={form.productSlug}
                    onChange={(event) => handleProductChange(event.target.value)}
                  >
                    <option value="">Homepage / General review</option>
                    {products.map((product) => (
                      <option key={product.slug} value={product.slug}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="returns-input"
                    value={form.productSlug}
                    onChange={(event) => setField("productSlug", event.target.value)}
                    placeholder="product-slug"
                  />
                )}
              </label>

              <label className="returns-field">
                <span className="returns-label">Product Name</span>
                <input
                  className="returns-input"
                  value={form.productName}
                  onChange={(event) => setField("productName", event.target.value)}
                  placeholder="Optional display name"
                />
              </label>

              <label className="returns-field review-admin-image-field">
                <span className="returns-label">Customer Image URL</span>
                <div className="review-admin-image-input">
                  <input
                    className="returns-input"
                    value={form.customerImage}
                    onChange={(event) => setField("customerImage", event.target.value)}
                    placeholder="https://..."
                  />
                  <span className="review-admin-avatar">
                    {form.customerImage ? (
                      <img src={form.customerImage} alt="" />
                    ) : (
                      getInitials(form.customerName)
                    )}
                  </span>
                </div>
              </label>

              <label className="returns-field">
                <span className="returns-label">Sort Order</span>
                <input
                  className="returns-input"
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) => setField("sortOrder", Number(event.target.value))}
                />
              </label>
            </div>

            <label className="returns-field">
              <span className="returns-label">Review Text</span>
              <textarea
                className="returns-textarea"
                value={form.text}
                onChange={(event) => setField("text", event.target.value)}
                placeholder="Write the customer review"
                required
              />
            </label>

            <div className="review-admin-check-row">
              <label>
                <input
                  type="checkbox"
                  checked={form.showOnHomepage}
                  onChange={(event) => setField("showOnHomepage", event.target.checked)}
                />
                Show on homepage
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(event) => setField("isPublished", event.target.checked)}
                />
                Published
              </label>
            </div>

            {message ? <p className="review-admin-message">{message}</p> : null}

            <div className="returns-btn-row">
              <button type="button" className="returns-btn-secondary" onClick={resetForm}>
                Clear
              </button>
              <button type="submit" className="returns-btn-primary" disabled={saving}>
                {editingId ? <Save size={16} /> : <Plus size={16} />}
                {saving ? "Saving..." : editingId ? "Save Changes" : "Add Review"}
              </button>
            </div>
          </form>
        </section>

        <nav className="returns-filter-tabs" aria-label="Review filters">
          {[
            ["all", "All"],
            ["published", "Published"],
            ["draft", "Drafts"],
            ["homepage", "Homepage"],
            ["product", "Product Reviews"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`returns-filter-tab ${filter === value ? "active" : ""}`}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </nav>

        <section className="returns-table-wrap">
          {filteredReviews.length === 0 ? (
            <div className="returns-table-empty">
              {loading ? "Loading reviews..." : "No reviews found for this filter."}
            </div>
          ) : (
            <table className="returns-table review-admin-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Review</th>
                  <th>Product</th>
                  <th>Rating</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReviews.map((review) => (
                  <tr key={review.id}>
                    <td>
                      <div className="review-admin-customer">
                        <span className="review-admin-avatar">
                          {review.customerImage ? (
                            <img src={review.customerImage} alt="" />
                          ) : (
                            review.initials || getInitials(review.customerName)
                          )}
                        </span>
                        <strong>{review.customerName}</strong>
                      </div>
                    </td>
                    <td>
                      <p className="review-admin-excerpt">{review.text}</p>
                    </td>
                    <td>
                      {review.productName || review.productSlug ? (
                        <span>{review.productName || review.productSlug}</span>
                      ) : (
                        <span className="review-admin-muted">General</span>
                      )}
                      {review.showOnHomepage ? (
                        <span className="review-admin-pill">
                          <Check size={12} />
                          Home
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <RatingStars rating={review.rating} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`review-admin-status ${review.isPublished ? "published" : "draft"}`}
                        onClick={() => togglePublished(review)}
                      >
                        {review.isPublished ? <Eye size={13} /> : <EyeOff size={13} />}
                        {review.isPublished ? "Published" : "Draft"}
                      </button>
                    </td>
                    <td>{formatDate(review.updatedAt)}</td>
                    <td>
                      <div className="returns-row-actions">
                        <button
                          type="button"
                          className="returns-action-btn view"
                          onClick={() => startEdit(review)}
                          title="Edit review"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          className="returns-action-btn reject"
                          onClick={() => handleDelete(review)}
                          title="Delete review"
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
        </section>
      </div>
    </main>
  );
}
