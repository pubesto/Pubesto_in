"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Lock, MapPin, ShieldCheck, Tag, Truck, X } from "lucide-react";
import { CHECKOUT_STORAGE_KEY, toCheckoutLine, useStore } from "@/components/StoreContext";
import {
  confirmRazorpayOrderAction,
  createRazorpayOrderAction,
  getCheckoutSummaryAction,
  placeOrderAction,
} from "@/app/actions/checkout";
import { trackInitiateCheckout, trackPurchase } from "@/lib/meta-pixel";
import { flushAnalytics, getSessionId } from "@/lib/analytics-client";
import { formatINR } from "@/lib/utils";
import { INDIAN_STATES } from "@/lib/indian-states";
import "../checkout.css";

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function splitName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") };
}

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  postalCode: "",
};

export default function CheckoutPage() {
  const {
    cartItems,
    setCartItems,
    isLoggedIn,
    isAuthLoading,
    user,
    paymentMethod: storePaymentMethod,
    setPaymentMethod: setStorePaymentMethod,
    getCartItemDisplayName,
  } = useStore();

  const [handoff, setHandoff] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [paymentMethod, setPaymentMethod] = useState(storePaymentMethod || "prepaid");
  const [promoInput, setPromoInput] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");
  const [formError, setFormError] = useState("");
  const [isPlacing, setIsPlacing] = useState(false);
  const [placed, setPlaced] = useState(null);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const prefilledRef = useRef(false);
  const initiateCheckoutSentRef = useRef(false);

  // Items come from "Buy now" / "Proceed to pay" (sessionStorage) or the cart.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(CHECKOUT_STORAGE_KEY) || "null");
      if (saved?.items?.length) {
        setHandoff(saved);
        if (saved.paymentMethod) setPaymentMethod(saved.paymentMethod);
        return;
      }
    } catch {
      /* ignore */
    }
    setHandoff({ source: "cart", items: null });
  }, []);

  const items = useMemo(() => {
    if (!handoff) return [];
    return handoff.items?.length ? handoff.items : cartItems;
  }, [handoff, cartItems]);

  const lines = useMemo(() => items.map(toCheckoutLine), [items]);

  // Checkout needs an account, as before (order history, tracking, saved addresses).
  useEffect(() => {
    if (isAuthLoading || placed) return;
    if (!isLoggedIn) {
      window.location.href = `/account/login?mode=signup&redirect=${encodeURIComponent("/checkout")}`;
    }
  }, [isAuthLoading, isLoggedIn, placed]);

  const savedAddresses = useMemo(() => (Array.isArray(user?.addresses) ? user.addresses : []), [user]);

  const applyAddress = useCallback((address) => {
    if (!address) return;
    const { firstName, lastName } = splitName(address.name);
    setSelectedAddressId(address.id || null);
    setForm((current) => ({
      ...current,
      firstName: firstName || current.firstName,
      lastName: lastName || current.lastName,
      phone: address.phone || current.phone,
      address1: address.line1 || "",
      address2: address.line2 || "",
      city: address.city || "",
      state: INDIAN_STATES.find((s) => s.toLowerCase() === String(address.state || "").toLowerCase()) || address.state || "",
      postalCode: address.pincode || "",
    }));
  }, []);

  useEffect(() => {
    if (!user || prefilledRef.current) return;
    prefilledRef.current = true;
    const { firstName, lastName } = splitName(user.name);
    setForm((current) => ({
      ...current,
      firstName: current.firstName || firstName,
      lastName: current.lastName || lastName,
      email: current.email || user.email || "",
      phone: current.phone || user.phone || "",
    }));
    const preferred = savedAddresses.find((a) => a.isDefault) || savedAddresses[0];
    if (preferred) applyAddress(preferred);
  }, [user, savedAddresses, applyAddress]);

  // Server-side price breakdown whenever the cart, payment method, coupon or state changes.
  useEffect(() => {
    if (!lines.length) return undefined;
    let active = true;
    const timer = setTimeout(async () => {
      const result = await getCheckoutSummaryAction({
        items: lines,
        paymentMethod,
        promoCode: promoCode || undefined,
        state: form.state || undefined,
      });
      if (!active) return;
      if (result.success) {
        setSummary(result.summary);
        setSummaryError("");
      } else {
        setSummary(null);
        setSummaryError(result.message);
      }
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [lines, paymentMethod, promoCode, form.state]);

  // Meta InitiateCheckout: once per page load, as soon as the shopper (logged in) sees a
  // priced checkout. Reloads within 30 min are de-duplicated inside trackInitiateCheckout.
  useEffect(() => {
    if (initiateCheckoutSentRef.current || placed) return;
    if (isAuthLoading || !isLoggedIn || !items.length) return;
    if (!summary && !summaryError) return; // wait for the server price
    initiateCheckoutSentRef.current = true;
    const fallbackValue = items.reduce(
      (sum, item) => sum + (Number((item.product || item).salePrice) || 0) * (Number(item.quantity) || 1),
      0
    );
    trackInitiateCheckout(items, summary?.total ?? fallbackValue);
  }, [isAuthLoading, isLoggedIn, items, summary, summaryError, placed]);

  function update(field) {
    return (event) => {
      setSelectedAddressId(null);
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };
  }

  function choosePayment(method) {
    setPaymentMethod(method);
    setStorePaymentMethod(method);
  }

  function validate() {
    if (!form.firstName.trim()) return "Enter your first name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Enter a valid email address.";
    if (form.phone.replace(/\D/g, "").length < 10) return "Enter a valid 10-digit mobile number.";
    if (form.address1.trim().length < 3) return "Enter your house / street address.";
    if (!form.city.trim()) return "Enter your city.";
    if (!form.state) return "Select your state.";
    if (!/^\d{6}$/.test(form.postalCode.trim())) return "Enter a valid 6-digit PIN code.";
    return "";
  }

  function finish(result) {
    try {
      sessionStorage.removeItem(CHECKOUT_STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
    try {
      // Meta Purchase once the order is confirmed: Razorpay payment verified by our server
      // (paid) or COD order placed. value = amount the customer pays. The server sends the
      // same event (event_id purchase_<reference>) and trackPurchase never fires twice.
      trackPurchase(items, result.total, { orderReference: result.reference });
    } catch {
      /* never let tracking break checkout */
    }
    if (!handoff?.items?.length || handoff.source === "cart") {
      setCartItems([]);
    } else {
      // "Buy now": drop the bought item from the cart if it was there too.
      const boughtIds = new Set(items.map((item) => item.id));
      setCartItems((current) => current.filter((item) => !boughtIds.has(item.id)));
    }
    setPlaced({ ...result, paymentMethod });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function placeOrder(event) {
    event.preventDefault();
    if (isPlacing) return;
    const problem = validate();
    if (problem) {
      setFormError(problem);
      return;
    }
    if (!summary) {
      setFormError(summaryError || "Your cart couldn't be priced. Please try again.");
      return;
    }
    setFormError("");
    setIsPlacing(true);

    const payload = {
      ...form,
      phone: form.phone.replace(/[^\d+]/g, ""),
      country: "India",
      shippingMethod: "standard",
      paymentMethod,
      promoCode: promoCode || undefined,
      saveAddress: !selectedAddressId,
      items: lines,
      analyticsSessionId: getSessionId() || undefined,
    };
    flushAnalytics();

    try {
      if (paymentMethod === "cod") {
        const result = await placeOrderAction(payload);
        if (!result.success) {
          setFormError(result.message);
          return;
        }
        finish(result);
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setFormError("Couldn't load the payment window. Check your connection and try again.");
        return;
      }
      const rzp = await createRazorpayOrderAction(payload);
      if (!rzp.success) {
        setFormError(rzp.message);
        return;
      }

      await new Promise((resolve) => {
        const razorpay = new window.Razorpay({
          key: rzp.keyId,
          amount: rzp.amount,
          currency: rzp.currency,
          name: "Pubesto",
          description: "Order payment",
          order_id: rzp.razorpayOrderId,
          prefill: {
            name: `${form.firstName} ${form.lastName}`.trim(),
            email: form.email,
            contact: payload.phone,
          },
          theme: { color: "#006994" },
          handler: async (response) => {
            const result = await confirmRazorpayOrderAction({
              ...payload,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            if (result.success) {
              finish(result);
            } else {
              setFormError(result.message);
            }
            resolve();
          },
          modal: {
            ondismiss: () => {
              setFormError("Payment was cancelled. You can try again or choose Cash on Delivery.");
              resolve();
            },
          },
        });
        razorpay.on("payment.failed", (response) => {
          setFormError(response?.error?.description || "Payment failed. Please try again.");
        });
        razorpay.open();
      });
    } catch (error) {
      console.error("Checkout failed:", error);
      setFormError("Something went wrong placing your order. Please try again.");
    } finally {
      setIsPlacing(false);
    }
  }

  if (placed) {
    return (
      <main className="pb-container pb-checkout">
        <section className="pb-panel pb-checkout-done">
          <CheckCircle2 size={56} strokeWidth={1.6} />
          <h1>Thank you! Your order is placed.</h1>
          <p>
            Order <b>{placed.reference}</b> · {formatINR(placed.total)}
            {placed.paymentMethod === "cod" ? " · Pay on delivery" : " · Paid online"}
          </p>
          <p className="pb-checkout-muted">
            We&apos;ve sent the details to {form.email}. You can track it any time from your account.
          </p>
          <div className="pb-checkout-done-actions">
            <Link className="pb-btn pb-btn-primary" href="/account?tab=orders" prefetch={false}>
              View my orders
            </Link>
            <Link className="pb-btn pb-btn-outline" href="/shop" prefetch={false}>
              Continue shopping
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (handoff && !items.length) {
    return (
      <main className="pb-container pb-checkout">
        <div className="pb-panel pb-empty" style={{ margin: "48px 0" }}>
          <h3>Your cart is empty</h3>
          <p>Add something you love and come back to check out.</p>
          <Link className="pb-btn pb-btn-primary" href="/shop" prefetch={false}>Start shopping</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="pb-container pb-checkout">
      <nav className="pb-crumbs" aria-label="Breadcrumb" style={{ padding: "20px 0 4px" }}>
        <Link href="/" prefetch={false}>Home</Link>
        <span>/</span>
        <Link href="/cart" prefetch={false}>Cart</Link>
        <span>/</span>
        <span>Checkout</span>
      </nav>
      <div className="pb-page-head" style={{ paddingTop: 4 }}>
        <h1>Checkout</h1>
        <p><Lock size={14} style={{ verticalAlign: "-2px" }} /> Secure checkout · Delivery across India</p>
      </div>

      <form className="pb-checkout-grid" onSubmit={placeOrder} noValidate>
        <div className="pb-checkout-main">
          <section className="pb-panel">
            <h2 className="pb-panel-title"><MapPin size={18} /> Delivery address</h2>
            {savedAddresses.length ? (
              <div className="pb-checkout-addresses">
                {savedAddresses.map((address) => (
                  <button
                    key={address.id || `${address.line1}-${address.pincode}`}
                    type="button"
                    className={`pb-checkout-address ${selectedAddressId && selectedAddressId === address.id ? "is-active" : ""}`}
                    onClick={() => applyAddress(address)}
                  >
                    <strong>{address.name || user?.name}</strong>
                    <span>{[address.line1, address.line2, address.city].filter(Boolean).join(", ")}</span>
                    <span>{[address.state, address.pincode].filter(Boolean).join(" - ")}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="pb-form">
              <div className="pb-checkout-row">
                <label className="pb-field">
                  <span>First name</span>
                  <input className="pb-input" autoComplete="given-name" value={form.firstName} onChange={update("firstName")} required />
                </label>
                <label className="pb-field">
                  <span>Last name</span>
                  <input className="pb-input" autoComplete="family-name" value={form.lastName} onChange={update("lastName")} />
                </label>
              </div>
              <div className="pb-checkout-row">
                <label className="pb-field">
                  <span>Mobile number</span>
                  <input className="pb-input" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={update("phone")} placeholder="10-digit mobile" required />
                </label>
                <label className="pb-field">
                  <span>Email</span>
                  <input className="pb-input" type="email" autoComplete="email" value={form.email} onChange={update("email")} required />
                </label>
              </div>
              <label className="pb-field">
                <span>House no., building, street</span>
                <input className="pb-input" autoComplete="address-line1" value={form.address1} onChange={update("address1")} required />
              </label>
              <label className="pb-field">
                <span>Area, landmark (optional)</span>
                <input className="pb-input" autoComplete="address-line2" value={form.address2} onChange={update("address2")} />
              </label>
              <div className="pb-checkout-row">
                <label className="pb-field">
                  <span>City</span>
                  <input className="pb-input" autoComplete="address-level2" value={form.city} onChange={update("city")} required />
                </label>
                <label className="pb-field">
                  <span>State</span>
                  <select className="pb-input" autoComplete="address-level1" value={form.state} onChange={update("state")} required>
                    <option value="">Select state</option>
                    {INDIAN_STATES.map((state) => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </label>
                <label className="pb-field">
                  <span>PIN code</span>
                  <input className="pb-input" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={form.postalCode} onChange={update("postalCode")} required />
                </label>
              </div>
            </div>
          </section>

          <section className="pb-panel">
            <h2 className="pb-panel-title">Payment method</h2>
            <div className="pb-pay-options">
              <button
                type="button"
                className={`pb-pay-option ${paymentMethod === "prepaid" ? "is-active" : ""}`}
                onClick={() => choosePayment("prepaid")}
              >
                <span className="pb-pay-flag">10% OFF</span>
                <strong>Pay online</strong>
                <small>UPI, cards &amp; netbanking</small>
              </button>
              <button
                type="button"
                className={`pb-pay-option ${paymentMethod === "cod" ? "is-active" : ""}`}
                onClick={() => choosePayment("cod")}
              >
                <strong>Cash on delivery</strong>
                <small>Pay when it arrives</small>
              </button>
            </div>
          </section>
        </div>

        <aside className="pb-checkout-side">
          <section className="pb-panel">
            <h2 className="pb-panel-title">Order summary</h2>
            <div className="pb-checkout-items">
              {items.map((item) => {
                const product = item.product || item;
                const line = summary?.lines.find((l) => l.productId === product.id) || null;
                return (
                  <div key={item.id} className="pb-checkout-item">
                    <span className="pb-checkout-thumb">
                      <img src={product.image} alt="" />
                      <b>{item.quantity}</b>
                    </span>
                    <span className="pb-checkout-item-name">{getCartItemDisplayName(product, item.quantity)}</span>
                    <span className="pb-checkout-item-price">
                      {line ? formatINR(line.lineTotal) : ""}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="pb-checkout-promo">
              {promoCode && summary?.promoCode ? (
                <div className="pb-checkout-promo-applied">
                  <Tag size={15} /> <b>{summary.promoCode}</b> applied
                  <button type="button" aria-label="Remove coupon" onClick={() => { setPromoCode(""); setPromoInput(""); }}>
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <div className="pb-checkout-row">
                  <input
                    className="pb-input"
                    placeholder="Coupon code"
                    value={promoInput}
                    onChange={(event) => setPromoInput(event.target.value.toUpperCase())}
                  />
                  <button type="button" className="pb-btn pb-btn-outline" onClick={() => setPromoCode(promoInput.trim())} disabled={!promoInput.trim()}>
                    Apply
                  </button>
                </div>
              )}
              {promoCode && summary && !summary.promoCode ? (
                <p className="pb-checkout-muted">
                  {paymentMethod === "prepaid" && summary.prepaidDiscount > 0
                    ? "Your prepaid discount saves more than this code, so we kept it."
                    : `"${promoCode}" can't be applied to this order.`}
                </p>
              ) : null}
            </div>

            {summary ? (
              <div className="pb-checkout-bill">
                <div className="pb-bill-row"><span>Items total</span><span>{formatINR(summary.subtotal)}</span></div>
                {summary.prepaidDiscount > 0 ? (
                  <div className="pb-bill-row is-green"><span>Prepaid discount (10%)</span><span>−{formatINR(summary.prepaidDiscount)}</span></div>
                ) : null}
                {summary.promoDiscount > 0 ? (
                  <div className="pb-bill-row is-green"><span>Coupon {summary.promoCode}</span><span>−{formatINR(summary.promoDiscount)}</span></div>
                ) : null}
                <div className="pb-bill-row">
                  <span><Truck size={14} style={{ verticalAlign: "-2px" }} /> {summary.shippingLabel}</span>
                  {summary.shipping === 0 ? <span style={{ color: "var(--pb-sea)", fontWeight: 700 }}>FREE</span> : <span>{formatINR(summary.shipping)}</span>}
                </div>
                <div className="pb-bill-row is-total"><span>To pay</span><span>{formatINR(summary.total)}</span></div>
                <p className="pb-checkout-muted" style={{ margin: "6px 0 0" }}>Prices include GST.</p>
              </div>
            ) : summaryError ? (
              <p className="pb-form-msg is-error">{summaryError}</p>
            ) : (
              <p className="pb-checkout-muted">Calculating…</p>
            )}

            {formError ? <p className="pb-form-msg is-error" role="alert">{formError}</p> : null}

            <button className="pb-checkout-btn" type="submit" disabled={isPlacing || !summary}>
              <span>
                {summary ? formatINR(summary.total) : "—"}
                <small>Total</small>
              </span>
              <span>
                {isPlacing ? "Processing…" : paymentMethod === "cod" ? "Place order" : "Pay now"} <ChevronRight size={20} />
              </span>
            </button>
            <p className="pb-checkout-trust">
              <ShieldCheck size={14} /> Safe &amp; secure payments by Razorpay
            </p>
          </section>
        </aside>
      </form>
    </main>
  );
}
