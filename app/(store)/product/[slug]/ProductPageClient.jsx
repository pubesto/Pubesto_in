"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  HelpCircle,
  Minus,
  PenLine,
  PackageCheck,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Star,
  Tag,
  Truck,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { useStore } from "@/components/StoreContext";
import ProductRail from "@/components/ProductRail";
import { useHydrated } from "@/components/useHydrated";
import { peopleChoiceVideos } from "@/lib/data";
import { trackViewContent } from "@/lib/meta-pixel";
import { track } from "@/lib/analytics-client";
import { formatINR, getDiscountPercent, getListableProducts, getOriginalPrice, getSalePrice } from "@/lib/utils";

const FREE_SHIPPING_THRESHOLD = 500;

function productMatchesRouteSlug(product, routeSlug) {
  const target = String(routeSlug || "").toLowerCase();
  if (!product || !target) return false;
  const candidates = [product.slug, product.shopifyHandle, product.handle, ...(product.slugAliases || [])]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return candidates.includes(target) || candidates.some((candidate) => candidate.includes(target));
}

function Stars({ value, size = 15 }) {
  const rounded = Math.round(Number(value) || 0);
  return (
    <span className="pb-stars" aria-label={`${value} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} size={size} fill={i < rounded ? "currentColor" : "none"} />
      ))}
    </span>
  );
}

function addBusinessDays(date, days) {
  const next = new Date(date);
  let added = 0;
  while (added < days) {
    next.setDate(next.getDate() + 1);
    if (next.getDay() !== 0) added += 1; // Sundays don't count
  }
  return next;
}

function formatDay(date) {
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function DeliveryEstimate() {
  // Rendered only after hydration so server and client markup match.
  const hydrated = useHydrated();
  if (!hydrated) return null;
  const now = new Date();
  const range = `${formatDay(addBusinessDays(now, 3))} – ${formatDay(addBusinessDays(now, 7))}`;
  return (
    <div className="pb-offer">
      <CalendarDays size={18} color="var(--pb-sea)" />
      <span>Estimated delivery: <b>{range}</b></span>
    </div>
  );
}

const PRODUCT_FAQS = [
  {
    q: "Is cash on delivery available?",
    a: "Yes, COD is available across India. Prepaid orders get an extra 10% off.",
  },
  {
    q: "How long does delivery take?",
    a: "Most orders are dispatched within 1–2 days and delivered within 5–7 business days after dispatch.",
  },
  {
    q: "Can I return the product?",
    a: "Eligible items can be returned within 7 days of delivery. Raise a request from the Request a return page.",
  },
  {
    q: "Is the product quality checked?",
    a: "Every order is checked and packed with care before dispatch.",
  },
];

function RatingBreakdown({ reviews, active, onSelect }) {
  const counts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => Math.round(r.rating) === star).length,
  }));
  const total = counts.reduce((sum, c) => sum + c.count, 0);
  if (!total) return null;
  return (
    <div className="pb-rating-bars">
      {counts.map(({ star, count }) => (
        <button
          key={star}
          type="button"
          className={`pb-rating-bar ${active === star ? "is-active" : ""}`}
          onClick={() => onSelect(active === star ? null : star)}
          disabled={!count}
          aria-pressed={active === star}
          aria-label={`Show ${star} star reviews (${count})`}
        >
          <Stars value={star} size={13} />
          <i><b style={{ width: `${(count / total) * 100}%` }} /></i>
          <span>{count}</span>
        </button>
      ))}
    </div>
  );
}

function ReviewForm({ product }) {
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [status, setStatus] = useState({ state: "idle", message: "" });

  async function submit(event) {
    event.preventDefault();
    if (text.trim().length < 20) {
      setStatus({ state: "error", message: "Please write at least 20 characters." });
      return;
    }
    setStatus({ state: "sending", message: "" });
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName: name, rating, text, productSlug: product.slug, productName: product.name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not submit your review.");
      setStatus({ state: "done", message: "Thank you! Your review will appear once it is approved." });
    } catch (err) {
      setStatus({ state: "error", message: err.message });
    }
  }

  if (status.state === "done") {
    return <p className="pb-review-form-note is-ok">{status.message}</p>;
  }

  return (
    <form className="pb-review-form" onSubmit={submit}>
      <div>
        <p className="pb-opt-label">Your rating</p>
        <div className="pb-star-input" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)}>
              <Star size={26} fill={n <= rating ? "currentColor" : "none"} />
            </button>
          ))}
        </div>
      </div>
      <label>
        <span className="pb-opt-label">Your name</span>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required placeholder="e.g. Priya S." />
      </label>
      <label>
        <span className="pb-opt-label">Your review</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={4} required placeholder="What did you like? How are you using it?" />
      </label>
      {status.state === "error" ? <p className="pb-review-form-note is-error">{status.message}</p> : null}
      <button className="pb-btn pb-btn-primary" type="submit" disabled={status.state === "sending"}>
        {status.state === "sending" ? "Submitting..." : "Submit review"}
      </button>
    </form>
  );
}

function getInitials(name) {
  return (name || "?").split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2);
}

function Gallery({ images, active, onSelect, name, badge }) {
  const [zoom, setZoom] = useState(null);

  return (
    <div className={`pb-gallery ${images.length < 2 ? "is-single" : ""}`}>
      {images.length > 1 ? (
        <div className="pb-thumbs">
          {images.map((img) => (
            <button key={img} type="button" className={`pb-thumb ${active === img ? "is-active" : ""}`} onClick={() => onSelect(img)} aria-label="Show image">
              <img src={img} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
      <div
        className="pb-stage"
        onMouseMove={(e) => {
          if (window.matchMedia("(hover: none)").matches) return;
          const rect = e.currentTarget.getBoundingClientRect();
          setZoom(`${((e.clientX - rect.left) / rect.width) * 100}% ${((e.clientY - rect.top) / rect.height) * 100}%`);
        }}
        onMouseLeave={() => setZoom(null)}
      >
        <motion.img
          key={active}
          src={active}
          alt={name}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35 }}
          style={zoom ? { transform: "scale(1.9)", transformOrigin: zoom } : undefined}
        />
        {badge}
      </div>
    </div>
  );
}

function ProductPageContent() {
  const { slug } = useParams();
  const {
    addToCart,
    checkout,
    getProductId,
    products,
    isLoggedIn,
    isAuthLoading,
    paymentMethod,
  } = useStore();

  const product = products.find((p) => productMatchesRouteSlug(p, slug));
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState(null);
  const [activeImage, setActiveImage] = useState(null);
  const [isBuyingNow, setIsBuyingNow] = useState(false);
  const [videoSoundOn, setVideoSoundOn] = useState(false);
  const [reviewData, setReviewData] = useState({ reviews: [], summary: null });
  const [storeReviews, setStoreReviews] = useState([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [visibleReviews, setVisibleReviews] = useState(6);
  const [reviewSort, setReviewSort] = useState("recent");
  const [starFilter, setStarFilter] = useState(null);

  const colors = useMemo(
    () => (Array.isArray(product?.colors) ? product.colors.filter((c) => c && c.name && c.hex) : []),
    [product]
  );
  const selectedColorName = selectedColor?.name || colors[0]?.name || "";

  // Reset selection when the product changes.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (!product) return;
    const firstColor = colors[0] || null;
    setSelectedColor(firstColor);
    setActiveImage(firstColor?.image || product.image);
    setQuantity(1);
  }, [product?.slug]);

  // Meta Pixel: one ViewContent per product URL.
  const viewTrackedForRef = useRef(null);
  useEffect(() => {
    if (!product || viewTrackedForRef.current === slug) return undefined;
    const fire = () => {
      if (viewTrackedForRef.current === slug) return;
      viewTrackedForRef.current = slug;
      trackViewContent(product);
      track("PRODUCT_VIEW", { name: product.slug, payload: { productId: product.id } });
    };
    // Product data comes from the server with real prices, so track right away.
    fire();
    return undefined;
  }, [slug, product]);

  useEffect(() => {
    document.body.classList.add("pb-has-sticky-buy");
    return () => document.body.classList.remove("pb-has-sticky-buy");
  }, []);

  useEffect(() => {
    if (!product?.slug) return undefined;
    let active = true;
    fetch(`/api/reviews?productSlug=${encodeURIComponent(product.slug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return null;
        setReviewData({ reviews: data.reviews || [], summary: data.summary });
        setStoreReviews([]);
        // No reviews for this product yet: load real reviews of other Pubesto products,
        // shown separately and labelled with the product each one is about.
        if (data.summary?.count) return null;
        return fetch("/api/reviews")
          .then((res) => (res.ok ? res.json() : null))
          .then((all) => {
            if (!active || !all) return;
            setStoreReviews(
              (all.reviews || [])
                .filter((r) => r.rating >= 4 && r.productSlug && r.productSlug !== product.slug)
                .slice(0, 6)
            );
          });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [product?.slug]);

  // Resume a "Buy now" that was interrupted by login/signup.
  useEffect(() => {
    if (isAuthLoading || !isLoggedIn || !product) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("buy_now") !== "true") return;
    const qty = parseInt(params.get("qty") || "1", 10);
    const colorParam = params.get("color");
    if (qty > 0) setQuantity(qty);
    const matched = colorParam && colors.find((c) => c.name.toLowerCase() === colorParam.toLowerCase());
    if (matched) {
      setSelectedColor(matched);
      setActiveImage(matched.image || product.image);
    }
    window.history.replaceState(null, "", window.location.pathname);
    handleBuyNow(qty, colorParam || selectedColorName);
  }, [isAuthLoading, isLoggedIn, product?.slug]);

  const listable = useMemo(() => getListableProducts(products), [products]);
  const related = useMemo(() => {
    if (!product) return [];
    const others = listable.filter((p) => p.slug !== product.slug);
    const sameCategory = others.filter((p) => (p.categories || []).some((c) => product.categories?.includes(c)));
    return [...sameCategory, ...others.filter((p) => !sameCategory.includes(p))].slice(0, 10);
  }, [listable, product]);

  if (!product) {
    return (
      <main className="pb-container">
        <div className="pb-panel pb-empty" style={{ margin: "48px 0" }}>
          <h3>Product not found</h3>
          <p>It may have sold out or moved.</p>
          <Link className="pb-btn pb-btn-primary" href="/shop" prefetch={false}>Browse all products</Link>
        </div>
      </main>
    );
  }

  const outOfStock = product.inStock === false;
  const sale = getSalePrice(product);
  const original = getOriginalPrice(product);
  const discount = getDiscountPercent(product);
  const lineTotal = sale * quantity;

  const images = Array.from(
    new Set([product.image, ...(product.gallery || []), ...colors.map((c) => c.image)].filter(Boolean))
  );
  const highlights = (product.highlights || []).filter(Boolean);
  const specs = product.specifications ? Object.entries(product.specifications) : [];
  const video = product.videoUrl
    ? { video: product.videoUrl, image: product.image }
    : peopleChoiceVideos.find((v) => v.slug === product.slug && v.video && !v.video.includes("pin.it"));

  const apiReviews = reviewData.reviews;
  const reviews = apiReviews.length
    ? apiReviews.map((r) => ({ id: r.id, name: r.customerName, text: r.text, rating: r.rating, date: r.createdAt }))
    : (product.reviewsList || []).map((r, i) => ({ id: i, name: r.name, text: r.text, rating: null }));
  const shownReviews = reviews
    .filter((r) => !starFilter || Math.round(r.rating) === starFilter)
    .sort((a, b) => {
      if (reviewSort === "highest") return (b.rating || 0) - (a.rating || 0);
      if (reviewSort === "lowest") return (a.rating || 0) - (b.rating || 0);
      return new Date(b.date || 0) - new Date(a.date || 0);
    });
  const ratingValue = reviewData.summary?.count ? reviewData.summary.averageRating : product.rating;
  const ratingCount = reviewData.summary?.count || product.reviews;
  // This product's own reviews or rating; when there are none, only the labelled
  // reviews of other Pubesto products are shown (no empty "No reviews yet" box).
  const hasOwnReviews = reviews.length > 0 || Boolean(ratingValue);

  function selectColor(color) {
    if (!color || color.available === false) return;
    setSelectedColor(color);
    setActiveImage(color.image || product.image);
  }

  function selectImage(img) {
    setActiveImage(img);
    const matched = colors.find((c) => c.image === img);
    if (matched) setSelectedColor(matched);
  }

  function handleAddToCart() {
    if (outOfStock) return;
    addToCart(product, { color: selectedColorName, quantity });
  }

  async function handleBuyNow(overrideQty = null, overrideColor = null) {
    if (outOfStock || isBuyingNow) return;
    const qty = overrideQty ?? quantity;
    const colorName = overrideColor ?? selectedColorName;

    if (!isLoggedIn) {
      const redirect = `${window.location.pathname}?buy_now=true&qty=${qty}&color=${encodeURIComponent(colorName)}`;
      window.location.href = `/account/login?mode=signup&redirect=${encodeURIComponent(redirect)}`;
      return;
    }

    setIsBuyingNow(true);
    try {
      const productToBuy = colorName ? { ...product, selectedColor: colorName } : product;
      await checkout({
        items: [{ id: getProductId(productToBuy), product: productToBuy, color: colorName, quantity: qty }],
        amount: sale * qty,
        paymentMethod,
      });
    } catch (err) {
      console.warn("Checkout error:", err.message);
    } finally {
      setIsBuyingNow(false);
    }
  }

  return (
    <main className="pb-container">
      <nav className="pb-crumbs" aria-label="Breadcrumb" style={{ padding: "20px 0 12px", marginBottom: 0 }}>
        <Link href="/" prefetch={false}>Home</Link>
        <span>/</span>
        {product.categories?.[0] ? (
          <>
            <Link href={`/shop?category=${encodeURIComponent(product.categories[0])}`} prefetch={false}>{product.categories[0]}</Link>
            <span>/</span>
          </>
        ) : (
          <>
            <Link href="/shop" prefetch={false}>Shop</Link>
            <span>/</span>
          </>
        )}
        <span>{product.name}</span>
      </nav>

      <div className="pb-pdp">
        <Gallery
          images={images}
          active={activeImage || product.image}
          onSelect={selectImage}
          name={product.name}
          badge={outOfStock ? <span className="pb-off-tag is-oos">Sold out</span> : discount > 0 ? <span className="pb-off-tag">{discount}% OFF</span> : null}
        />

        <motion.div className="pb-info" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1>{product.name}</h1>
          <div className="pb-info-meta">
            {ratingValue ? (
              <>
                <span className="pb-rating" style={{ fontSize: 13, padding: "3px 8px" }}>
                  {ratingValue} <Star size={11} fill="currentColor" strokeWidth={0} />
                </span>
                {ratingCount ? <a href="#reviews">{ratingCount} ratings</a> : null}
              </>
            ) : null}
            {product.detail ? <span>· {product.detail}</span> : null}
          </div>

          <div className="pb-buybox">
            <div>
              <div className="pb-pdp-price">
                <strong>{formatINR(sale)}</strong>
                {original > sale ? <s>MRP {formatINR(original)}</s> : null}
                {discount > 0 ? <em>{discount}% OFF</em> : null}
              </div>
              <p className="pb-tax-note" style={{ marginTop: 4 }}>Inclusive of all taxes</p>
            </div>

            <div className="pb-offers">
              <div className="pb-offer">
                <Zap size={18} color="var(--pb-turq-ink)" fill="var(--pb-turq)" />
                <span>Pay online & get <b>extra 10% off</b> — you pay <b>{formatINR(Math.round(lineTotal * 0.9))}</b></span>
              </div>
              <DeliveryEstimate />
              <div className={`pb-offer ${lineTotal >= FREE_SHIPPING_THRESHOLD ? "is-green" : ""}`}>
                <Truck size={18} color="var(--pb-sea)" />
                {lineTotal >= FREE_SHIPPING_THRESHOLD ? (
                  <span><b>FREE shipping</b> on this order</span>
                ) : (
                  <span>Add <b>{formatINR(FREE_SHIPPING_THRESHOLD - lineTotal)}</b> more for <b>FREE shipping</b></span>
                )}
              </div>
            </div>

            {colors.length ? (
              <div>
                <p className="pb-opt-label">Colour: <b>{selectedColorName}</b></p>
                <div className="pb-swatches" role="radiogroup" aria-label="Select colour">
                  {colors.map((color) => {
                    const isActive = selectedColorName === color.name;
                    return (
                      <button
                        key={color.name}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        className={`pb-swatch ${isActive ? "is-active" : ""}`}
                        style={{ "--sw": color.hex }}
                        disabled={color.available === false}
                        onClick={() => selectColor(color)}
                      >
                        <i /> {color.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="pb-buy-row">
              <div className="pb-qty">
                <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Decrease quantity"><Minus size={16} /></button>
                <span>{quantity}</span>
                <button type="button" onClick={() => setQuantity((q) => q + 1)} aria-label="Increase quantity"><Plus size={16} /></button>
              </div>
              <button className="pb-btn pb-btn-primary" type="button" onClick={handleAddToCart} disabled={outOfStock}>
                <ShoppingCart size={18} /> {outOfStock ? "Sold out" : "Add to cart"}
              </button>
              <button className="pb-btn pb-btn-turq" type="button" onClick={() => handleBuyNow()} disabled={outOfStock || isBuyingNow}>
                <Zap size={18} /> {isBuyingNow ? "Redirecting..." : "Buy now"}
              </button>
            </div>

            <div className="pb-trust">
              <div><Truck size={22} /> Pan-India delivery</div>
              <div><RotateCcw size={22} /> 7-day returns</div>
              <div><ShieldCheck size={22} /> Secure payments</div>
              <div><PackageCheck size={22} /> Quality checked</div>
            </div>
          </div>

          <div className="pb-panel" style={{ marginTop: 16, padding: "4px 20px" }}>
            {product.description || highlights.length ? (
              <details className="pb-acc" open>
                <summary>About this item <ChevronDown size={18} /></summary>
                <div className="pb-acc-body">
                  {product.description ? <p style={{ marginTop: 0 }}>{product.description}</p> : null}
                  {highlights.length ? (
                    <ul className="pb-highlights">
                      {highlights.map((h) => (
                        <li key={h}><CheckCircle2 size={17} /> {h}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </details>
            ) : null}
            {specs.length ? (
              <details className="pb-acc">
                <summary>Specifications <ChevronDown size={18} /></summary>
                <div className="pb-acc-body">
                  <dl className="pb-specs">
                    {specs.map(([key, value]) => (
                      <div key={key}><dt>{key}</dt><dd>{value}</dd></div>
                    ))}
                  </dl>
                </div>
              </details>
            ) : null}
            <details className="pb-acc">
              <summary>Product details <ChevronDown size={18} /></summary>
              <div className="pb-acc-body">
                <dl className="pb-specs">
                  {product.categories?.[0] ? <div><dt>Category</dt><dd>{product.categories[0]}</dd></div> : null}
                  {product.sku ? <div><dt>SKU</dt><dd>{product.sku}</dd></div> : null}
                  {colors.length ? <div><dt>Colours</dt><dd>{colors.map((c) => c.name).join(", ")}</dd></div> : null}
                  <div><dt>Availability</dt><dd>{outOfStock ? "Sold out" : "In stock"}</dd></div>
                  <div><dt>Ships from</dt><dd>New Delhi, India</dd></div>
                </dl>
              </div>
            </details>
            <details className="pb-acc">
              <summary>Delivery & returns <ChevronDown size={18} /></summary>
              <div className="pb-acc-body">
                <ul className="pb-highlights">
                  <li><Truck size={17} /> Delivered within 5–7 business days after dispatch. Free shipping above ₹500, otherwise ₹70.</li>
                  <li><RotateCcw size={17} /> Return eligible items within 7 days of delivery. <Link href="/refund-return-policy" style={{ color: "var(--pb-sea)", fontWeight: 700 }}>Policy</Link></li>
                  <li><Tag size={17} /> Cash on delivery available. Prepaid orders get an extra 10% off.</li>
                </ul>
              </div>
            </details>
          </div>
        </motion.div>
      </div>

      {video ? (
        <section className="pb-section">
          <div className="pb-section-head">
            <div>
              <h2>See it for yourself</h2>
            </div>
          </div>
          <div className="pb-video">
            <video src={video.video} poster={video.image} autoPlay muted={!videoSoundOn} loop playsInline preload="metadata" />
            <button className="pb-reel-sound" type="button" onClick={() => setVideoSoundOn((v) => !v)} aria-label={videoSoundOn ? "Mute video" : "Unmute video"}>
              {videoSoundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          </div>
        </section>
      ) : null}

      {hasOwnReviews || storeReviews.length ? (
      <section className="pb-section" id="reviews">
        <div className="pb-section-head">
          <div>
            <h2>{hasOwnReviews ? "Customer reviews" : "What customers say about Pubesto"}</h2>
          </div>
        </div>
        {hasOwnReviews ? (
        <div className="pb-review-top">
          {ratingValue ? (
            <div className="pb-rating-summary" style={{ marginBottom: 0 }}>
              <span className="pb-rating-big">{ratingValue}</span>
              <span>
                <Stars value={ratingValue} size={18} />
                <div style={{ fontSize: 13.5, color: "var(--pb-muted)", marginTop: 4 }}>{ratingCount ? `Based on ${ratingCount} ratings` : null}</div>
              </span>
            </div>
          ) : null}
          <RatingBreakdown
            reviews={reviews.filter((r) => r.rating)}
            active={starFilter}
            onSelect={(star) => { setStarFilter(star); setVisibleReviews(6); }}
          />
          <button className="pb-btn pb-btn-outline" type="button" onClick={() => setShowReviewForm((v) => !v)}>
            <PenLine size={17} /> {showReviewForm ? "Cancel review" : "Write a review"}
          </button>
        </div>
        ) : null}
        {hasOwnReviews && showReviewForm ? <ReviewForm product={product} /> : null}
        {reviews.length ? (
          <div className="pb-review-toolbar">
            <span>
              {starFilter ? (
                <>
                  Showing {shownReviews.length} {starFilter}-star review{shownReviews.length === 1 ? "" : "s"}{" "}
                  <button type="button" onClick={() => setStarFilter(null)}>Show all</button>
                </>
              ) : (
                <>{reviews.length} review{reviews.length === 1 ? "" : "s"}</>
              )}
            </span>
            {reviews.some((r) => r.rating) ? (
              <label>
                <span className="pb-sr-only">Sort reviews</span>
                <select value={reviewSort} onChange={(e) => setReviewSort(e.target.value)}>
                  <option value="recent">Most recent</option>
                  <option value="highest">Highest rating</option>
                  <option value="lowest">Lowest rating</option>
                </select>
              </label>
            ) : null}
          </div>
        ) : null}
        {shownReviews.length ? (
          <div className="pb-review-list">
            {shownReviews.slice(0, visibleReviews).map((review) => (
              <article key={review.id} className="pb-review">
                <div className="pb-review-who" style={{ borderTop: 0, paddingTop: 0 }}>
                  <span className="pb-avatar">{getInitials(review.name)}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong>{review.name}</strong>
                    {review.date ? (
                      <small style={{ color: "var(--pb-muted)", fontWeight: 500 }}>
                        {new Date(review.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </small>
                    ) : null}
                  </span>
                </div>
                {review.rating ? <Stars value={review.rating} /> : null}
                <p>{review.text}</p>
              </article>
            ))}
          </div>
        ) : null}
        {shownReviews.length > visibleReviews ? (
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button className="pb-btn pb-btn-outline" type="button" onClick={() => setVisibleReviews((n) => n + 6)}>
              Show more reviews
            </button>
          </div>
        ) : null}
        {!reviews.length && storeReviews.length ? (
          <div className="pb-store-reviews">
            {hasOwnReviews ? <h3>What customers say about other Pubesto products</h3> : null}
            <div className="pb-review-list">
              {storeReviews.map((review) => {
                const reviewed = products.find((p) => p.slug === review.productSlug);
                return (
                  <article key={review.id} className="pb-review">
                    <div className="pb-review-who" style={{ borderTop: 0, paddingTop: 0 }}>
                      <span className="pb-avatar">{getInitials(review.customerName)}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <strong>{review.customerName}</strong>
                        <small style={{ color: "var(--pb-muted)", fontWeight: 500 }}>
                          {new Date(review.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </small>
                      </span>
                    </div>
                    <Stars value={review.rating} />
                    <p>{review.text}</p>
                    <span className="pb-review-about">
                      Review for{" "}
                      {reviewed ? (
                        <Link href={`/product/${reviewed.slug}`} prefetch={false}>{reviewed.name}</Link>
                      ) : (
                        review.productName || "another product"
                      )}
                    </span>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>
      ) : null}

      <section className="pb-section" id="faq">
        <div className="pb-section-head">
          <div>
            <h2>Frequently asked questions</h2>
          </div>
        </div>
        <div className="pb-panel" style={{ padding: "4px 20px" }}>
          {PRODUCT_FAQS.map((item) => (
            <details key={item.q} className="pb-acc">
              <summary>
                <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                  <HelpCircle size={17} color="var(--pb-sea)" /> {item.q}
                </span>
                <ChevronDown size={18} />
              </summary>
              <div className="pb-acc-body"><p style={{ margin: 0 }}>{item.a}</p></div>
            </details>
          ))}
        </div>
      </section>

      <ProductRail title="You might also like" products={related} href="/shop" />

      <div className="pb-sticky-buy">
        <button className="pb-btn pb-btn-outline" type="button" onClick={handleAddToCart} disabled={outOfStock}>
          <ShoppingCart size={18} /> Add · {formatINR(lineTotal)}
        </button>
        <button className="pb-btn pb-btn-primary" type="button" onClick={() => handleBuyNow()} disabled={outOfStock || isBuyingNow}>
          {isBuyingNow ? "Redirecting..." : "Buy now"} <ChevronRight size={18} />
        </button>
      </div>
    </main>
  );
}

export default function ProductPageClient() {
  return <ProductPageContent />;
}
