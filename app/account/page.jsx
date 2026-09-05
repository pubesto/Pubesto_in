"use client";

import "../auth.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  Home,
  LogOut,
  MapPin,
  PackageX,
  Plus,
  Save,
  Trash2,
  UserRound,
  Truck,
  ShoppingBag,
  ShoppingCart,
  Package,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ReceiptText,
  Search,
  X,
  ArrowUpRight,
  Sparkles,
  Box,
  RotateCcw,
} from "lucide-react";
import { useStore } from "../../components/StoreContext";

const EMPTY_ADDRESS = {
  label: "Home",
  name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
};

// Status config with colors and icons
const STATUS_CONFIG = {
  processing: {
    label: "Processing",
    emoji: "⏳",
    color: "#b45309",
    bg: "rgba(245, 158, 11, 0.08)",
    border: "rgba(245, 158, 11, 0.2)",
    icon: Clock,
  },
  confirmed: {
    label: "Confirmed",
    emoji: "✅",
    color: "#059669",
    bg: "rgba(5, 150, 105, 0.08)",
    border: "rgba(5, 150, 105, 0.2)",
    icon: CheckCircle2,
  },
  shipped: {
    label: "Shipped",
    emoji: "🚚",
    color: "#2563eb",
    bg: "rgba(37, 99, 235, 0.08)",
    border: "rgba(37, 99, 235, 0.2)",
    icon: Truck,
  },
  delivered: {
    label: "Delivered",
    emoji: "📦",
    color: "#1b624b",
    bg: "rgba(27, 98, 75, 0.08)",
    border: "rgba(27, 98, 75, 0.2)",
    icon: Box,
  },
  cancelled: {
    label: "Cancelled",
    emoji: "❌",
    color: "#dc2626",
    bg: "rgba(220, 38, 38, 0.06)",
    border: "rgba(220, 38, 38, 0.15)",
    icon: X,
  },
};

function generateOrderId() {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PUB-${year}-${rand}`;
}

// Resolve image live from products context — always returns the latest Shopify CDN URL
function resolveProductImage(slug, products, fallback = "/images/products/neck-fan.png") {
  if (fallback && (fallback.startsWith("http") || fallback.startsWith("//"))) {
    return fallback;
  }
  if (!slug || !products?.length) return fallback;
  // Try exact slug match first
  let match = products.find((p) => p.slug === slug);
  // Try slugAliases if no exact match
  if (!match) {
    match = products.find(
      (p) => Array.isArray(p.slugAliases) && p.slugAliases.includes(slug)
    );
  }
  // Try partial match on slug or shopifyHandle
  if (!match) {
    match = products.find(
      (p) =>
        (p.shopifyHandle && p.shopifyHandle.includes(slug)) ||
        (slug && slug.includes(p.slug))
    );
  }
  return match?.image || fallback;
}

function getMockOrders(products) {
  const neckFan = products?.find((p) => p.slug === "adjustable-bladeless-neck-fan");
  const tumbler = products?.find((p) =>
    p.slug === "b-111-1200ml-bluetooth-speaker-tumbler" ||
    (Array.isArray(p.slugAliases) && p.slugAliases.includes("b-111-1200ml-bluetooth-speaker-tumbler"))
  );
  const lunchBox = products?.find((p) => p.slug === "hamburger-kids-lunch-box");
  const mist = products?.find((p) => p.slug === "mini-mist-cooling-fan");

  return [
    {
      id: "PUB-2026-8942",
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      items: [
        {
          id: neckFan?.slug || "adjustable-bladeless-neck-fan",
          name: neckFan?.name || "Adjustable Bladeless Neck Fan",
          image: neckFan?.image || "/images/products/neck-fan.png",
          price: "Rs. 800",
          priceNumber: 800,
          quantity: 2,
          slug: "adjustable-bladeless-neck-fan",
          color: "Arctic White",
        },
      ],
      subtotal: 1600,
      shipping: 0,
      total: 1600,
      status: "processing",
      paymentStatus: "paid",
      paymentId: "pay_mock_123456",
    },
    {
      id: "PUB-2026-7215",
      date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      items: [
        {
          id: tumbler?.slug || "b-111-1200ml-bluetooth-speaker-tumbler",
          name: tumbler?.name || "B-111 1200ml Bluetooth Speaker Tumbler",
          image: tumbler?.image || "/images/products/speaker-tumbler.jpg",
          price: "Rs. 3,950",
          priceNumber: 3950,
          quantity: 1,
          slug: "b-111-1200ml-bluetooth-speaker-tumbler",
        },
      ],
      subtotal: 3950,
      shipping: 0,
      total: 3950,
      status: "shipped",
      paymentStatus: "paid",
      paymentId: "pay_mock_789012",
    },
    {
      id: "PUB-2026-5890",
      date: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(),
      items: [
        {
          id: lunchBox?.slug || "hamburger-kids-lunch-box",
          name: lunchBox?.name || "Hamburger Kids Lunch Box",
          image: lunchBox?.image || "/images/products/lunch-box.jpg",
          price: "Rs. 285",
          priceNumber: 285,
          quantity: 3,
          slug: "hamburger-kids-lunch-box",
        },
        {
          id: mist?.slug || "mini-mist-cooling-fan",
          name: mist?.name || "Mini Mist Cooling Fan",
          image: mist?.image || "/images/products/mist-fan.jpg",
          price: "Rs. 1,600",
          priceNumber: 1600,
          quantity: 1,
          slug: "mini-mist-cooling-fan",
          color: "Green",
        },
      ],
      subtotal: 2455,
      shipping: 0,
      total: 2455,
      status: "delivered",
      paymentStatus: "paid",
      paymentId: "pay_mock_345678",
    },
  ];
}

// Order Status Badge
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.processing;
  const Icon = cfg.icon;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "11px",
        fontWeight: 700,
        padding: "4px 10px",
        borderRadius: "20px",
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={11} strokeWidth={2.5} />
      {cfg.label}
    </span>
  );
}

// Payment Badge
function PaymentBadge({ status }) {
  const isPaid = status === "paid";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "11px",
        fontWeight: 700,
        padding: "4px 10px",
        borderRadius: "20px",
        background: isPaid ? "rgba(27, 98, 75, 0.08)" : "rgba(220, 38, 38, 0.06)",
        color: isPaid ? "#1b624b" : "#dc2626",
        border: `1px solid ${isPaid ? "rgba(27, 98, 75, 0.2)" : "rgba(220, 38, 38, 0.15)"}`,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        whiteSpace: "nowrap",
      }}
    >
      💳 {isPaid ? "Paid" : "Unpaid"}
    </span>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const { user, setUser, isAuthLoading, refreshAuthSession, logout, products } = useStore();
  const [account, setAccount] = useState(null);
  const [profileForm, setProfileForm] = useState({ name: "", phone: "" });
  const [addressForm, setAddressForm] = useState(EMPTY_ADDRESS);
  const [editingAddressId, setEditingAddressId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);

  // Orders state
  const [orders, setOrders] = useState([]);
  const [ordersFilter, setOrdersFilter] = useState("all");
  const [ordersSearch, setOrdersSearch] = useState("");
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [activeTab, setActiveTab] = useState("profile");

  // Load & sync orders — always re-seed mock orders when live products arrive
  // so images are always fresh Shopify CDN URLs, never stale local paths
  const loadOrders = useCallback(async () => {
    // 1. Load existing local orders first
    let localSavedOrders = [];
    try {
      const saved = localStorage.getItem("pubesto_orders");
      if (saved) {
        localSavedOrders = JSON.parse(saved);
      }
    } catch (e) {
      console.error(e);
    }

    try {
      const response = await fetch("/api/account/orders", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        if (data.orders) {
          // Merge Shopify orders and local orders (avoiding duplicates)
          const mergedOrders = [...data.orders];
          for (const localOrd of localSavedOrders) {
            if (!mergedOrders.some(o => o.id === localOrd.id)) {
              mergedOrders.push(localOrd);
            }
          }
          setOrders(mergedOrders);
          localStorage.setItem("pubesto_orders", JSON.stringify(mergedOrders));
          return;
        }
      }
    } catch (e) {
      console.error("Failed to load real Shopify orders, trying localStorage fallback:", e);
    }

    // Fallback: load from localStorage if fetch failed
    setOrders(localSavedOrders);
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Auth guard
  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/account/login?redirect=/account");
    }
  }, [isAuthLoading, user, router]);

  // Load account data
  useEffect(() => {
    async function loadAccount() {
      if (!user) return;
      setLoading(true);
      try {
        const response = await fetch("/api/account", { cache: "no-store" });
        const data = await response.json();
        if (response.ok) {
          setAccount(data.user);
          setProfileForm({ name: data.user.name || "", phone: data.user.phone || "" });
        }
      } finally {
        setLoading(false);
      }
    }
    loadAccount();
  }, [user]);

  // Hash/tab navigation with smooth scroll
  useEffect(() => {
    if (!loading && account) {
      const checkTab = () => {
        const search = window.location.search;
        const hash = window.location.hash;
        const isOrders = search.includes("tab=orders") || hash === "#orders";
        if (isOrders) {
          setActiveTab("orders");
          setTimeout(() => {
            document.getElementById("orders")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 100);
        }
      };
      checkTab();
      window.addEventListener("hashchange", checkTab);
      return () => window.removeEventListener("hashchange", checkTab);
    }
  }, [loading, account]);

  // Profile helpers
  function setProfileField(field, value) {
    setProfileForm((c) => ({ ...c, [field]: value }));
  }
  function setAddressField(field, value) {
    setAddressForm((c) => ({ ...c, [field]: value }));
  }

  async function patchAccount(updates) {
    const response = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not update account.");
    setAccount(data.user);
    setUser?.(data.user);
    await refreshAuthSession?.();
    return data.user;
  }

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await patchAccount(profileForm);
      setMessage("Profile updated successfully.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveAddress(event) {
    event.preventDefault();
    if (!account) return;
    setSaving(true);
    setMessage("");
    const nextAddress = { ...addressForm, id: editingAddressId || `addr_${Date.now()}` };
    const currentAddresses = Array.isArray(account.addresses) ? account.addresses : [];
    const addresses = editingAddressId
      ? currentAddresses.map((a) => (a.id === editingAddressId ? nextAddress : a))
      : [...currentAddresses, nextAddress];
    try {
      await patchAccount({ addresses });
      setAddressForm(EMPTY_ADDRESS);
      setEditingAddressId("");
      setMessage(editingAddressId ? "Address updated." : "Address added.");
      setShowForm(false);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteAddress(id) {
    if (!account) return;
    setSaving(true);
    setMessage("");
    try {
      await patchAccount({ addresses: (account.addresses || []).filter((a) => a.id !== id) });
      setMessage("Address removed.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  function editAddress(address) {
    setEditingAddressId(address.id);
    setShowForm(true);
    setAddressForm({
      label: address.label || "Home",
      name: address.name || "",
      phone: address.phone || "",
      line1: address.line1 || "",
      line2: address.line2 || "",
      city: address.city || "",
      state: address.state || "",
      pincode: address.pincode || "",
    });
    setTimeout(() => {
      document.getElementById("address-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  // Orders helpers
  const filteredOrders = orders
    .filter((o) => (ordersFilter === "all" ? true : o.status === ordersFilter))
    .filter((o) => {
      if (!ordersSearch.trim()) return true;
      const q = ordersSearch.toLowerCase();
      return (
        o.id.toLowerCase().includes(q) ||
        o.items.some((item) => item.name.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const orderCounts = {
    all: orders.length,
    processing: orders.filter((o) => o.status === "processing").length,
    shipped: orders.filter((o) => o.status === "shipped").length,
    delivered: orders.filter((o) => o.status === "delivered").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  };

  if (isAuthLoading || loading || !account) {
    return (
      <main className="account-page">
        <div className="account-container">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "16px" }}>
            <div style={{ width: "40px", height: "40px", border: "3px solid rgba(27,98,75,0.15)", borderTopColor: "#1b624b", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <p style={{ color: "var(--muted)", fontSize: "14px", fontWeight: 600 }}>Loading your account...</p>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    );
  }

  return (
    <main className="account-page">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(27, 98, 75, 0.15); }
          50% { box-shadow: 0 0 0 8px rgba(27, 98, 75, 0); }
        }
        .order-card { animation: fadeSlideIn 0.35s ease both; }
        .order-card:nth-child(1) { animation-delay: 0.05s; }
        .order-card:nth-child(2) { animation-delay: 0.1s; }
        .order-card:nth-child(3) { animation-delay: 0.15s; }
        .order-card:nth-child(4) { animation-delay: 0.2s; }
        .orders-filter-tab { 
          padding: 7px 14px; border-radius: 9999px; font-size: 12.5px; font-weight: 700;
          border: 1px solid rgba(211, 201, 189, 0.5); background: #fff; cursor: pointer;
          transition: all 0.18s ease; color: var(--muted); display: inline-flex; align-items: center; gap: 6px;
          white-space: nowrap;
        }
        .orders-filter-tab:hover { border-color: rgba(27, 98, 75, 0.3); color: var(--brand-color); }
        .orders-filter-tab.active { background: var(--brand-color); color: #fff; border-color: var(--brand-color); }
        .orders-filter-tab .tab-count {
          display: inline-flex; align-items: center; justify-content: center;
          width: 18px; height: 18px; border-radius: 50%; font-size: 10px;
          background: rgba(255,255,255,0.22); color: inherit;
        }
        .orders-filter-tab.active .tab-count { background: rgba(255,255,255,0.25); }
        .order-action-btn {
          padding: 8px 18px; font-size: 12.5px; font-weight: 700; border-radius: 9999px;
          transition: all 0.18s ease; text-decoration: none; display: inline-flex; align-items: center; gap: 5px;
          cursor: pointer; border: 1px solid; white-space: nowrap;
        }
        .order-action-btn.cancel { color: #dc2626; border-color: rgba(220,38,38,0.3); background: rgba(220,38,38,0.02); }
        .order-action-btn.cancel:hover { background: rgba(220,38,38,0.06); border-color: rgba(220,38,38,0.5); }
        .order-action-btn.track { color: #1b624b; border-color: rgba(27,98,75,0.4); background: #fff; }
        .order-action-btn.track:hover { background: rgba(27,98,75,0.04); }
        .order-action-btn.reorder { color: #2563eb; border-color: rgba(37,99,235,0.3); background: rgba(37,99,235,0.02); }
        .order-action-btn.reorder:hover { background: rgba(37,99,235,0.06); }
        .account-tab-bar { display: flex; gap: 4px; padding: 5px; background: #f0ede8; border-radius: 12px; margin-bottom: 32px; }
        .account-tab-btn {
          flex: 1; padding: 10px 16px; border-radius: 9px; font-size: 13.5px; font-weight: 700;
          border: none; cursor: pointer; transition: all 0.18s ease; color: var(--muted);
          background: transparent; display: flex; align-items: center; justify-content: center; gap: 7px;
        }
        .account-tab-btn.active { background: #fff; color: var(--brand-color); box-shadow: 0 4px 14px rgba(27,98,75,0.1); }
        .order-item-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; }
        .order-item-row:not(:last-child) { border-bottom: 1px solid rgba(211,201,189,0.25); }
        .order-search-wrap { position: relative; }
        .order-search-wrap svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
        .order-search-input {
          width: 100%; padding: 10px 12px 10px 38px; border: 1px solid rgba(211,201,189,0.5);
          border-radius: 10px; background: #fff; font-size: 13px; color: var(--ink);
          outline: none; transition: border-color 0.18s;
        }
        .order-search-input:focus { border-color: rgba(27,98,75,0.4); box-shadow: 0 0 0 3px rgba(27,98,75,0.06); }
        .order-progress-bar { display: flex; align-items: center; gap: 0; margin: 16px 0 4px; }
        .order-progress-step {
          display: flex; flex-direction: column; align-items: center; flex: 1; position: relative;
        }
        .order-progress-step:not(:last-child)::after {
          content: ''; position: absolute; top: 14px; left: 50%; width: 100%; height: 2px;
          background: rgba(211,201,189,0.4); z-index: 0;
        }
        .order-progress-step.done:not(:last-child)::after { background: #1b624b; }
        .order-progress-dot {
          width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 800; z-index: 1; border: 2px solid rgba(211,201,189,0.5);
          background: #f8f6f2; color: var(--muted);
        }
        .order-progress-dot.done { background: #1b624b; border-color: #1b624b; color: #fff; }
        .order-progress-dot.active { background: #fff; border-color: #1b624b; color: #1b624b; animation: pulseGlow 1.8s infinite; }
        .order-progress-label { font-size: 10px; font-weight: 700; color: var(--muted); margin-top: 5px; text-align: center; }
        .order-progress-label.done { color: #1b624b; }
        .order-progress-label.active { color: #1b624b; }
      `}</style>

      <div className="account-container">
        {/* === HEADER === */}
        <header className="account-header">
          <div className="account-hero-profile">
            <div className="account-avatar">
              {account.name
                ? account.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                : "C"}
            </div>
            <div>
              <span className="auth-eyebrow">Customer Account</span>
              <h1>Welcome, {account.name.split(" ")[0]}</h1>
              <p className="account-hero-email">{account.email}</p>
            </div>
          </div>
          <button className="account-logout" type="button" onClick={handleLogout}>
            <LogOut size={16} />
            Logout
          </button>
        </header>

        {message ? (
          <p className="account-message" style={{ animation: "fadeSlideIn 0.3s ease" }}>{message}</p>
        ) : null}

        {/* === TAB BAR === */}
        <div className="account-tab-bar">
          <button
            className={`account-tab-btn${activeTab === "orders" ? " active" : ""}`}
            type="button"
            onClick={() => setActiveTab("orders")}
          >
            <Package size={16} />
            My Orders
            {orders.length > 0 && (
              <span style={{ fontSize: "10px", fontWeight: 800, padding: "2px 7px", borderRadius: "20px", background: activeTab === "orders" ? "rgba(27,98,75,0.1)" : "rgba(0,0,0,0.06)", color: activeTab === "orders" ? "#1b624b" : "var(--muted)" }}>
                {orders.length}
              </span>
            )}
          </button>
          <button
            className={`account-tab-btn${activeTab === "profile" ? " active" : ""}`}
            type="button"
            onClick={() => setActiveTab("profile")}
          >
            <UserRound size={16} />
            Profile & Addresses
          </button>
        </div>

        {/* ======================== */}
        {/* === ORDERS TAB ========= */}
        {/* ======================== */}
        {activeTab === "orders" && (
          <section id="orders" style={{ animation: "fadeSlideIn 0.3s ease" }}>
            {/* Section heading */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <span className="auth-eyebrow">Purchase History</span>
                <h2 style={{ margin: "4px 0 0", fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                  My Orders
                </h2>
              </div>
              <button
                type="button"
                onClick={loadOrders}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "9999px", border: "1px solid rgba(211,201,189,0.6)", background: "#fff", fontSize: "12.5px", fontWeight: 700, color: "var(--muted)", cursor: "pointer", transition: "all 0.18s" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(27,98,75,0.4)"; e.currentTarget.style.color = "#1b624b"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(211,201,189,0.6)"; e.currentTarget.style.color = "var(--muted)"; }}
              >
                <RefreshCw size={13} />
                Refresh
              </button>
            </div>

            {/* Search */}
            <div className="order-search-wrap" style={{ marginBottom: "14px" }}>
              <Search size={15} />
              <input
                className="order-search-input"
                type="text"
                placeholder="Search by Order ID or product name..."
                value={ordersSearch}
                onChange={(e) => setOrdersSearch(e.target.value)}
              />
              {ordersSearch && (
                <button type="button" onClick={() => setOrdersSearch("")}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex" }}>
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter tabs */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "20px", overflowX: "auto", paddingBottom: "4px" }}>
              {[
                { key: "all", label: "All Orders" },
                { key: "processing", label: "Processing" },
                { key: "shipped", label: "Shipped" },
                { key: "delivered", label: "Delivered" },
                { key: "cancelled", label: "Cancelled" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`orders-filter-tab${ordersFilter === tab.key ? " active" : ""}`}
                  onClick={() => setOrdersFilter(tab.key)}
                >
                  {tab.label}
                  <span className="tab-count">{orderCounts[tab.key]}</span>
                </button>
              ))}
            </div>

            {/* Orders list */}
            {filteredOrders.length === 0 ? (
              <div style={{ padding: "60px 24px", textAlign: "center", background: "#fff", border: "1px solid rgba(211,201,189,0.4)", borderRadius: "20px" }}>
                <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(27,98,75,0.05)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "var(--brand-color)" }}>
                  {ordersSearch ? <Search size={26} /> : <ShoppingBag size={26} />}
                </div>
                <h3 style={{ fontSize: "17px", fontWeight: 800, margin: "0 0 8px", color: "var(--ink)" }}>
                  {ordersSearch ? "No orders match your search" : "No orders yet"}
                </h3>
                <p style={{ fontSize: "13.5px", color: "var(--muted)", maxWidth: "320px", margin: "0 auto 20px", lineHeight: 1.6 }}>
                  {ordersSearch
                    ? `No results found for "${ordersSearch}". Try a different search.`
                    : "You haven't placed any orders yet. Browse our shop to find something you'll love!"}
                </p>
                {ordersSearch ? (
                  <button type="button" onClick={() => setOrdersSearch("")} className="order-action-btn track">
                    <X size={13} /> Clear Search
                  </button>
                ) : (
                  <Link href="/shop" style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 24px", borderRadius: "9999px", background: "#1b624b", color: "#fff", fontWeight: 700, fontSize: "13px", textDecoration: "none" }}>
                    <Sparkles size={14} />
                    Start Shopping
                  </Link>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {filteredOrders.map((order) => {
                  const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.processing;
                  const StatusIcon = statusCfg.icon;
                  const isExpanded = expandedOrder === order.id;
                  const canCancel = order.status === "processing";
                  const canTrack = ["shipped", "delivered"].includes(order.status);

                  // Progress steps
                  const allSteps = ["processing", "confirmed", "shipped", "delivered"];
                  const currentStepIdx = allSteps.indexOf(order.status);

                  return (
                    <div
                      key={order.id}
                      className="order-card account-card"
                      style={{
                        borderRadius: "18px",
                        border: `1px solid rgba(211,201,189,0.45)`,
                        background: "#fff",
                        overflow: "hidden",
                        boxShadow: isExpanded
                          ? "0 8px 32px rgba(27,98,75,0.07)"
                          : "0 2px 8px rgba(27,98,75,0.02)",
                        transition: "box-shadow 0.2s ease",
                      }}
                    >
                      {/* Card header — always visible */}
                      <div
                        onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                        style={{
                          padding: "18px 20px",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "12px",
                          userSelect: "none",
                          background: isExpanded ? "rgba(27,98,75,0.015)" : "#fff",
                          transition: "background 0.2s ease",
                        }}
                      >
                        {/* Left: ID + date */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          <span style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Order ID</span>
                          <span style={{ fontSize: "14.5px", fontWeight: 800, color: "var(--brand-color)", fontFamily: "monospace", letterSpacing: "0.03em" }}>
                            {order.id}
                          </span>
                          <span style={{ fontSize: "12px", color: "var(--muted)", marginTop: "1px" }}>
                            {new Date(order.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                          </span>
                        </div>

                        {/* Right: badges + chevron */}
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <StatusBadge status={order.status} />
                          <PaymentBadge status={order.paymentStatus || "paid"} />
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "50%", background: "rgba(211,201,189,0.15)", transition: "transform 0.2s ease", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>
                            <ChevronRight size={15} color="var(--muted)" />
                          </div>
                        </div>
                      </div>

                      {/* Quick preview: item thumbnails when collapsed */}
                      {!isExpanded && (
                        <div style={{ padding: "0 20px 16px", display: "flex", alignItems: "center", gap: "10px", borderTop: "1px solid rgba(211,201,189,0.2)" }}>
                          <div style={{ display: "flex", gap: "-6px" }}>
                            {order.items.slice(0, 3).map((item, i) => (
                              <img
                                key={i}
                                src={resolveProductImage(item.slug, products, item.image)}
                                alt={item.name}
                                style={{ width: "36px", height: "36px", objectFit: "cover", borderRadius: "7px", border: "2px solid #fff", marginLeft: i > 0 ? "-10px" : "0", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}
                                onError={(e) => { e.currentTarget.src = "/images/products/neck-fan.png"; }}
                              />
                            ))}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {order.items.map((i) => i.name).join(", ")}
                            </p>
                            <p style={{ fontSize: "11.5px", color: "var(--muted)", margin: "2px 0 0" }}>
                              {order.items.reduce((s, i) => s + i.quantity, 0)} item{order.items.reduce((s, i) => s + i.quantity, 0) > 1 ? "s" : ""} · <strong style={{ color: "var(--brand-color)" }}>Rs. {order.total.toLocaleString("en-IN")}</strong>
                            </p>
                          </div>
                          {/* Quick action */}
                          {canCancel && (
                            <Link href={`/orders/cancel?orderId=${order.id}`} className="order-action-btn cancel" onClick={(e) => e.stopPropagation()}>
                              <PackageX size={12} /> Cancel
                            </Link>
                          )}
                          {canTrack && (
                            <Link href={`/returns/track?orderId=${order.id}`} className="order-action-btn track" onClick={(e) => e.stopPropagation()}>
                              <Truck size={12} /> Track
                            </Link>
                          )}
                        </div>
                      )}

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div style={{ borderTop: "1px solid rgba(211,201,189,0.25)", animation: "fadeSlideIn 0.25s ease" }}>
                          {/* Order progress tracker */}
                          {order.status !== "cancelled" && (
                            <div style={{ padding: "16px 24px", background: "rgba(27,98,75,0.015)", borderBottom: "1px solid rgba(211,201,189,0.15)" }}>
                              <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>Order Progress</p>
                              <div className="order-progress-bar">
                                {allSteps.map((step, idx) => {
                                  const isDone = idx < currentStepIdx;
                                  const isActive = idx === currentStepIdx;
                                  const StepIcon = STATUS_CONFIG[step]?.icon || CheckCircle2;
                                  return (
                                    <div key={step} className={`order-progress-step${isDone ? " done" : isActive ? " active" : ""}`}>
                                      <div className={`order-progress-dot${isDone ? " done" : isActive ? " active" : ""}`}>
                                        {isDone ? <CheckCircle2 size={14} /> : <StepIcon size={13} />}
                                      </div>
                                      <span className={`order-progress-label${isDone ? " done" : isActive ? " active" : ""}`}>
                                        {STATUS_CONFIG[step]?.label || step}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Items list */}
                          <div style={{ padding: "4px 24px 0" }}>
                            {order.items.map((item, idx) => (
                              <div key={idx} className="order-item-row">
                                <Link href={`/product/${item.slug}`} style={{ display: "block", flexShrink: 0 }}>
                                  <img
                                    src={resolveProductImage(item.slug, products, item.image)}
                                    alt={item.name}
                                    style={{ width: "58px", height: "58px", objectFit: "cover", borderRadius: "10px", border: "1px solid rgba(211,201,189,0.35)" }}
                                    onError={(e) => { e.currentTarget.src = "/images/products/neck-fan.png"; }}
                                  />
                                </Link>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <Link href={`/product/${item.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                                    <h5 style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)", margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {item.name}
                                    </h5>
                                  </Link>
                                  {item.color && (
                                    <p style={{ fontSize: "11.5px", color: "var(--muted)", margin: "0 0 3px" }}>Colour: {item.color}</p>
                                  )}
                                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>
                                    Qty: <strong>{item.quantity}</strong> × {item.price}
                                  </p>
                                </div>
                                <span style={{ fontSize: "15px", fontWeight: 800, color: "var(--ink)", flexShrink: 0 }}>
                                  Rs. {((item.priceNumber || 0) * item.quantity).toLocaleString("en-IN")}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Footer: total + actions */}
                          <div style={{ padding: "14px 24px 18px", borderTop: "1px dashed rgba(211,201,189,0.35)", marginTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                              <div style={{ display: "flex", gap: "16px" }}>
                                <span style={{ fontSize: "12.5px", color: "var(--muted)" }}>Subtotal: <strong style={{ color: "var(--ink)" }}>Rs. {order.subtotal.toLocaleString("en-IN")}</strong></span>
                                <span style={{ fontSize: "12.5px", color: "var(--muted)" }}>Shipping: <strong style={{ color: "var(--ink)" }}>{order.shipping === 0 ? "Free" : `Rs. ${order.shipping}`}</strong></span>
                              </div>
                              <div>
                                <span style={{ fontSize: "13px", color: "var(--muted)" }}>Total: </span>
                                <strong style={{ fontSize: "20px", fontWeight: 900, color: "var(--brand-color)" }}>
                                  Rs. {order.total.toLocaleString("en-IN")}
                                </strong>
                              </div>
                              {order.paymentId && (
                                <span style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "monospace" }}>
                                  Payment ID: {order.paymentId}
                                </span>
                              )}
                            </div>

                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                              {canCancel && (
                                <Link href={`/orders/cancel?orderId=${order.id}`} className="order-action-btn cancel">
                                  <PackageX size={13} />
                                  Cancel Order
                                </Link>
                              )}
                              {canTrack && (
                                <Link href={`/returns/track?orderId=${order.id}`} className="order-action-btn track">
                                  <Truck size={13} />
                                  Track Order
                                </Link>
                              )}
                              {order.status === "delivered" && (
                                <Link href={`/returns/track?orderId=${order.id}`} className="order-action-btn reorder">
                                  <RotateCcw size={13} />
                                  Return/Exchange
                                </Link>
                              )}
                              <Link href="/shop" className="order-action-btn track">
                                <ArrowUpRight size={13} />
                                Shop Again
                              </Link>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Summary stats */}
            {orders.length > 0 && (
              <div style={{ marginTop: "24px", padding: "16px 20px", background: "rgba(27,98,75,0.03)", border: "1px solid rgba(27,98,75,0.08)", borderRadius: "14px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "16px" }}>
                {[
                  { label: "Total Orders", value: orders.length, icon: Package },
                  { label: "Total Spent", value: `Rs. ${orders.reduce((s, o) => s + (o.total || 0), 0).toLocaleString("en-IN")}`, icon: ReceiptText },
                  { label: "Items Ordered", value: orders.reduce((s, o) => s + o.items.reduce((is, i) => is + i.quantity, 0), 0), icon: ShoppingBag },
                  { label: "In Progress", value: orders.filter((o) => ["processing", "shipped"].includes(o.status)).length, icon: Truck },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} style={{ textAlign: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", color: "var(--brand-color)", marginBottom: "4px" }}>
                      <Icon size={14} />
                    </div>
                    <p style={{ fontSize: "20px", fontWeight: 900, color: "var(--ink)", margin: "0 0 2px" }}>{value}</p>
                    <p style={{ fontSize: "11px", color: "var(--muted)", margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ======================== */}
        {/* === PROFILE TAB ======== */}
        {/* ======================== */}
        {activeTab === "profile" && (
          <div style={{ animation: "fadeSlideIn 0.3s ease" }}>
            {/* Quick links */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginBottom: "28px" }}>
              {[
                { icon: Package, label: "My Orders", count: orders.length, onClick: () => setActiveTab("orders"), color: "#1b624b" },
                { icon: PackageX, label: "Cancel Order", href: "/orders/cancel", color: "#dc2626" },
                { icon: Truck, label: "Track Order", href: "/returns/track", color: "#2563eb" },
                { icon: ShoppingBag, label: "Shop Now", href: "/shop", color: "#7c3aed" },
              ].map(({ icon: Icon, label, count, onClick, href, color }) => {
                const content = (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", padding: "18px 12px", borderRadius: "14px", border: "1px solid rgba(211,201,189,0.4)", background: "#fff", textDecoration: "none", cursor: "pointer", transition: "all 0.18s ease", textAlign: "center", height: "100%" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 4px 20px ${color}15`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(211,201,189,0.4)"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: `${color}12`, display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}>
                      <Icon size={18} />
                    </div>
                    <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--ink)" }}>{label}</span>
                    {count !== undefined && <span style={{ fontSize: "10px", color, fontWeight: 800 }}>{count} orders</span>}
                  </div>
                );
                if (href) return <Link key={label} href={href} style={{ display: 'block', textDecoration: 'none', height: '100%' }}>{content}</Link>;
                return <div key={label} role="button" onClick={onClick} style={{ display: 'block', textDecoration: 'none', height: '100%' }}>{content}</div>;
              })}
            </div>

            <section className="account-grid">
              {/* Profile form */}
              <form className="account-card" onSubmit={saveProfile}>
                <div className="account-card-header">
                  <UserRound size={22} />
                  <div>
                    <h2>Profile</h2>
                    <p>Used for saved checkout details and support.</p>
                  </div>
                </div>
                <label>
                  <span>Name</span>
                  <input value={profileForm.name} onChange={(e) => setProfileField("name", e.target.value)} required />
                </label>
                <label>
                  <span>Email</span>
                  <input value={account.email} disabled />
                </label>
                <label>
                  <span>Phone</span>
                  <input value={profileForm.phone} onChange={(e) => setProfileField("phone", e.target.value)} placeholder="+91 98765 43210" />
                </label>
                <button className="account-primary" type="submit" disabled={saving}>
                  <Save size={16} />
                  {saving ? "Saving..." : "Save Profile"}
                </button>
              </form>

              {/* Account tools */}
              <section className="account-card">
                <div className="account-card-header">
                  <Home size={22} />
                  <div>
                    <h2>Account Tools</h2>
                    <p>Quick access to customer self-service.</p>
                  </div>
                </div>
                <div className="account-link-list">
                  <button type="button" onClick={() => setActiveTab("orders")} style={{ all: "unset", cursor: "pointer", width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", color: "var(--ink)", fontWeight: 600, fontSize: "14px", borderBottom: "1px solid rgba(211,201,189,0.3)" }}>
                    <Package size={16} color="var(--brand-color)" />
                    View my orders
                    <ChevronRight size={14} style={{ marginLeft: "auto" }} />
                  </button>
                  <Link href="/orders/cancel">
                    <PackageX size={16} />
                    Cancel product order
                  </Link>
                  <Link href="/returns/track">
                    <Truck size={16} />
                    Track your order
                  </Link>
                  <Link href="/shop">
                    <ShoppingBag size={16} />
                    Continue shopping
                  </Link>
                  <Link href="/cart">
                    <ShoppingCart size={16} />
                    View cart
                  </Link>
                </div>
              </section>
            </section>

            {/* Addresses */}
            <section className="account-address-section" id="addresses" style={{ marginTop: "28px" }}>
              <div className="account-section-heading">
                <div>
                  <span className="auth-eyebrow">Delivery Details</span>
                  <h2>Saved Addresses</h2>
                </div>
                {!showForm && (
                  <button
                    className="account-primary"
                    type="button"
                    style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "10px", fontSize: "14px", fontWeight: "700" }}
                    onClick={() => { setEditingAddressId(""); setAddressForm(EMPTY_ADDRESS); setShowForm(true); }}
                  >
                    <Plus size={16} />
                    Add Address
                  </button>
                )}
              </div>

              <div className={showForm ? "account-address-grid" : ""}>
                {showForm && (
                  <form className="account-card" id="address-form" onSubmit={saveAddress}>
                    <div className="account-card-header">
                      <MapPin size={22} />
                      <div>
                        <h2>{editingAddressId ? "Edit Address" : "Add Address"}</h2>
                        <p>Keep delivery details ready for future orders.</p>
                      </div>
                    </div>
                    <div className="account-two-col">
                      <label><span>Label</span><input value={addressForm.label} onChange={(e) => setAddressField("label", e.target.value)} placeholder="Home / Office" /></label>
                      <label><span>Recipient</span><input value={addressForm.name} onChange={(e) => setAddressField("name", e.target.value)} required placeholder="Full name" /></label>
                    </div>
                    <label><span>Phone</span><input value={addressForm.phone} onChange={(e) => setAddressField("phone", e.target.value)} required placeholder="+91 XXXXX XXXXX" /></label>
                    <label><span>Address Line 1</span><input value={addressForm.line1} onChange={(e) => setAddressField("line1", e.target.value)} required placeholder="Street address, flat/house no." /></label>
                    <label><span>Address Line 2</span><input value={addressForm.line2} onChange={(e) => setAddressField("line2", e.target.value)} placeholder="Landmark, area (optional)" /></label>
                    <div className="account-two-col">
                      <label><span>City</span><input value={addressForm.city} onChange={(e) => setAddressField("city", e.target.value)} required /></label>
                      <label><span>State</span><input value={addressForm.state} onChange={(e) => setAddressField("state", e.target.value)} required /></label>
                    </div>
                    <label><span>Pincode</span><input value={addressForm.pincode} onChange={(e) => setAddressField("pincode", e.target.value)} required maxLength={6} /></label>
                    <div className="account-actions-row">
                      <button className="account-secondary" type="button" onClick={() => { setEditingAddressId(""); setAddressForm(EMPTY_ADDRESS); setShowForm(false); }}>Cancel</button>
                      <button className="account-primary" type="submit" disabled={saving}>
                        {editingAddressId ? <Save size={16} /> : <Plus size={16} />}
                        {editingAddressId ? "Save Address" : "Add Address"}
                      </button>
                    </div>
                  </form>
                )}

                <div className={`account-address-list ${showForm ? "form-open" : "form-closed"}`}>
                  {(account.addresses || []).length === 0 ? (
                    <div className="account-empty-card">
                      <div className="empty-card-icon"><MapPin size={24} /></div>
                      <h3>No saved addresses</h3>
                      <p>Save your delivery addresses here for a faster, one-click checkout experience on future orders.</p>
                      {!showForm && (
                        <button
                          className="account-primary"
                          type="button"
                          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "10px", fontSize: "14px", fontWeight: "700" }}
                          onClick={() => { setEditingAddressId(""); setAddressForm(EMPTY_ADDRESS); setShowForm(true); }}
                        >
                          <Plus size={16} />
                          Add New Address
                        </button>
                      )}
                    </div>
                  ) : (
                    account.addresses.map((address) => (
                      <article className="account-address-card" key={address.id}>
                        <strong>{address.label}</strong>
                        <p>{address.name} - {address.phone}</p>
                        <p>{address.line1}{address.line2 ? `, ${address.line2}` : ""}</p>
                        <p>{address.city}, {address.state} {address.pincode}</p>
                        <div className="account-actions-row">
                          <button className="account-secondary" type="button" onClick={() => editAddress(address)}>Edit</button>
                          <button className="account-danger" type="button" onClick={() => deleteAddress(address.id)}>
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
