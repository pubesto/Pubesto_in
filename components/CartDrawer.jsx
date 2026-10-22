"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, PartyPopper, ShieldCheck, ShoppingBag, Truck, X, Zap } from "lucide-react";
import { useStore } from "./StoreContext";
import { QuantityStepper } from "./ProductCard";
import { formatINR } from "../lib/utils";

const FREE_SHIPPING_THRESHOLD = 500;

function FloatingCartBar() {
  const { cartItems, cartCount, cartTotal, isCartOpen, setIsCartOpen } = useStore();
  const pathname = usePathname();
  const hidden = isCartOpen || cartCount === 0 || pathname.startsWith("/account");

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.button
          className="pb-floatcart"
          type="button"
          onClick={() => setIsCartOpen(true)}
          initial={{ y: 80, opacity: 0, x: "-50%" }}
          animate={{ y: 0, opacity: 1, x: "-50%" }}
          exit={{ y: 80, opacity: 0, x: "-50%" }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        >
          <span className="pb-floatcart-thumbs">
            {cartItems.slice(0, 3).map((item) => (
              <img key={item.id} src={item.product.image} alt="" />
            ))}
          </span>
          <span className="pb-floatcart-copy">
            <strong>{cartCount} item{cartCount === 1 ? "" : "s"} · {formatINR(cartTotal)}</strong>
            <small>
              {cartTotal >= FREE_SHIPPING_THRESHOLD
                ? "Free shipping unlocked"
                : `${formatINR(FREE_SHIPPING_THRESHOLD - cartTotal)} away from free shipping`}
            </small>
          </span>
          <span className="pb-floatcart-cta">
            View cart <ChevronRight size={18} />
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

export default function CartDrawer() {
  const {
    isCartOpen,
    setIsCartOpen,
    cartItems,
    cartCount,
    cartTotal,
    paymentMethod,
    setPaymentMethod,
    prepaidDiscountAmount,
    cartShippingFee,
    cartFinalTotal,
    updateCartQuantity,
    checkout,
    isLoggedIn,
    getCartItemTotalPrice,
    getCartItemTotalOldPrice,
    getCartItemDisplayName,
  } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  useEffect(() => {
    if (!isCartOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event) => event.key === "Escape" && setIsCartOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [isCartOpen, setIsCartOpen]);

  // Close the drawer on route change, except the /cart → / hop that exists to open it.
  const previousPathRef = useRef(pathname);
  useEffect(() => {
    if (previousPathRef.current !== "/cart") setIsCartOpen(false);
    previousPathRef.current = pathname;
  }, [pathname]);

  const shippingProgress = Math.min(100, (cartTotal / FREE_SHIPPING_THRESHOLD) * 100);
  const mrpTotal = cartItems.reduce((sum, item) => sum + getCartItemTotalOldPrice(item.product, item.quantity), 0);
  const productSavings = Math.max(0, mrpTotal - cartTotal);
  const totalSavings = productSavings + prepaidDiscountAmount;

  async function handleCheckout() {
    if (!isLoggedIn) {
      setIsCartOpen(false);
      router.push(`/account/login?mode=signup&redirect=${encodeURIComponent("/cart")}`);
      return;
    }
    setIsCheckingOut(true);
    try {
      await checkout({ items: cartItems, amount: cartTotal, paymentMethod });
    } finally {
      setIsCheckingOut(false);
    }
  }

  return (
    <>
      <FloatingCartBar />
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.button
              className="pb-backdrop"
              type="button"
              aria-label="Close cart"
              onClick={() => setIsCartOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.aside
              className="pb-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Shopping cart"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
            >
              <div className="pb-drawer-head">
                <h2>My Cart {cartCount > 0 ? <span style={{ color: "var(--pb-muted)", fontWeight: 600, fontSize: 15 }}>({cartCount})</span> : null}</h2>
                <button className="pb-close" type="button" onClick={() => setIsCartOpen(false)} aria-label="Close cart">
                  <X size={19} />
                </button>
              </div>

              {cartItems.length === 0 ? (
                <div className="pb-drawer-body">
                  <div className="pb-empty">
                    <div className="pb-empty-art">
                      <ShoppingBag size={48} strokeWidth={1.5} />
                    </div>
                    <h3>Your cart is empty</h3>
                    <p>Bestsellers are just a tap away.</p>
                    <Link className="pb-btn pb-btn-primary" href="/shop" onClick={() => setIsCartOpen(false)} prefetch={false}>
                      Start shopping
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <div className="pb-drawer-body">
                    <div className="pb-panel pb-ship-meter">
                      <p>
                        <span className="pb-ship-ico">{shippingProgress >= 100 ? <PartyPopper size={18} /> : <Truck size={18} />}</span>
                        {shippingProgress >= 100 ? (
                          <span>Yay! You&apos;ve unlocked <b>FREE shipping</b></span>
                        ) : (
                          <span>Add <b>{formatINR(FREE_SHIPPING_THRESHOLD - cartTotal)}</b> more for <b>FREE shipping</b></span>
                        )}
                      </p>
                      <div className="pb-meter"><span style={{ width: `${shippingProgress}%` }} /></div>
                    </div>

                    <div className="pb-panel">
                      <AnimatePresence initial={false}>
                        {cartItems.map((item) => {
                          const lineTotal = getCartItemTotalPrice(item.product, item.quantity);
                          const lineMrp = getCartItemTotalOldPrice(item.product, item.quantity);
                          return (
                            <motion.div
                              key={item.id}
                              className="pb-cart-line"
                              layout
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                            >
                              <Link href={`/product/${item.product.slug}`} onClick={() => setIsCartOpen(false)} prefetch={false}>
                                <img src={item.product.image} alt={item.product.name} />
                              </Link>
                              <div style={{ minWidth: 0 }}>
                                <h4>{getCartItemDisplayName(item.product, item.quantity)}</h4>
                                <div className="pb-cart-line-price">
                                  {formatINR(lineTotal)}
                                  {lineMrp > lineTotal ? <s>{formatINR(lineMrp)}</s> : null}
                                </div>
                              </div>
                              <div className="pb-cart-line-right">
                                <QuantityStepper size="sm" quantity={item.quantity} onChange={(next) => updateCartQuantity(item.id, next)} />
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>

                    <div className="pb-panel">
                      <h3 className="pb-panel-title">Payment method</h3>
                      <div className="pb-pay-options">
                        <button
                          type="button"
                          className={`pb-pay-option ${paymentMethod === "prepaid" ? "is-active" : ""}`}
                          onClick={() => setPaymentMethod("prepaid")}
                        >
                          <span className="pb-pay-flag">10% OFF</span>
                          <strong>Pay online</strong>
                          <small>UPI, cards &amp; netbanking</small>
                        </button>
                        <button
                          type="button"
                          className={`pb-pay-option ${paymentMethod === "cod" ? "is-active" : ""}`}
                          onClick={() => setPaymentMethod("cod")}
                        >
                          <strong>Cash on delivery</strong>
                          <small>Standard price</small>
                        </button>
                      </div>
                    </div>

                    <div className="pb-panel">
                      <h3 className="pb-panel-title">Bill details</h3>
                      <div className="pb-bill-row">
                        <span>Items total</span>
                        <span>
                          {mrpTotal > cartTotal ? <s style={{ color: "var(--pb-muted)", marginRight: 6 }}>{formatINR(mrpTotal)}</s> : null}
                          {formatINR(cartTotal)}
                        </span>
                      </div>
                      {prepaidDiscountAmount > 0 ? (
                        <div className="pb-bill-row is-green">
                          <span>Prepaid discount (10%)</span>
                          <span>−{formatINR(prepaidDiscountAmount)}</span>
                        </div>
                      ) : null}
                      <div className="pb-bill-row">
                        <span>Shipping</span>
                        {cartShippingFee === 0 ? <span style={{ color: "var(--pb-sea)", fontWeight: 700 }}>FREE</span> : <span>{formatINR(cartShippingFee)}</span>}
                      </div>
                      <div className="pb-bill-row is-total">
                        <span>To pay</span>
                        <span>{formatINR(cartFinalTotal)}</span>
                      </div>
                      {totalSavings > 0 ? (
                        <div className="pb-savings">
                          <Zap size={16} /> You&apos;re saving {formatINR(totalSavings)} on this order
                        </div>
                      ) : null}
                    </div>

                    <p style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12.5, color: "var(--pb-muted)", margin: "4px 0 8px" }}>
                      <ShieldCheck size={14} /> Safe &amp; secure payments · Taxes calculated at checkout
                    </p>
                  </div>

                  <div className="pb-drawer-foot">
                    <button className="pb-checkout-btn" type="button" onClick={handleCheckout} disabled={isCheckingOut}>
                      <span>
                        {formatINR(cartFinalTotal)}
                        <small>Total</small>
                      </span>
                      <span>
                        {isCheckingOut ? "Processing..." : isLoggedIn ? "Proceed to pay" : "Login to checkout"} <ChevronRight size={20} />
                      </span>
                    </button>
                  </div>
                </>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
