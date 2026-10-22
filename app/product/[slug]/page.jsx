"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Minus,
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
import { useStore } from "../../../components/StoreContext";
import ProductRail from "../../../components/ProductRail";
import { peopleChoiceVideos } from "../../../lib/data";
import { trackInitiateCheckout, trackViewContent } from "../../../lib/meta-pixel";
import { formatINR, getDiscountPercent, getListableProducts, getOriginalPrice, getSalePrice } from "../../../lib/utils";

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

  // Meta Pixel: one ViewContent per product URL. Keyed on the route slug because the
  // product object (and its slug) changes when Shopify data replaces the local fallback.
  // Waits for Shopify data (real price + handle) so ViewContent matches AddToCart; falls
  // back to the local product after 3s if Shopify is slow or unavailable.
  const viewTrackedForRef = useRef(null);
  useEffect(() => {
    if (!product || viewTrackedForRef.current === slug) return undefined;
    const fire = () => {
      if (viewTrackedForRef.current === slug) return;
      viewTrackedForRef.current = slug;
      trackViewContent(product);
    };
    if (product.shopifyVariantId) {
      fire();
      return undefined;
    }
    const timer = setTimeout(fire, 3000);
    return () => clearTimeout(timer);
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
      .then((data) => active && data && setReviewData({ reviews: data.reviews || [], summary: data.summary }))
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
  const video = peopleChoiceVideos.find((v) => v.slug === product.slug && v.video && !v.video.includes("pin.it"));

  const apiReviews = reviewData.reviews;
  const reviews = apiReviews.length
    ? apiReviews.map((r) => ({ id: r.id, name: r.customerName, text: r.text, rating: r.rating, verified: true }))
    : (product.reviewsList || []).map((r, i) => ({ id: i, name: r.name, text: r.text, rating: null }));
  const ratingValue = reviewData.summary?.count ? reviewData.summary.averageRating : product.rating;
  const ratingCount = reviewData.summary?.count || product.reviews;

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
      const productToTrack = colorName ? { ...product, selectedColor: colorName } : product;
      trackInitiateCheckout([{ product: productToTrack, quantity: qty }], sale * qty);
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

      {reviews.length ? (
        <section className="pb-section" id="reviews">
          <div className="pb-section-head">
            <div>
              <h2>Customer reviews</h2>
            </div>
          </div>
          {ratingValue ? (
            <div className="pb-rating-summary">
              <span className="pb-rating-big">{ratingValue}</span>
              <span>
                <Stars value={ratingValue} size={18} />
                <div style={{ fontSize: 13.5, color: "var(--pb-muted)", marginTop: 4 }}>{ratingCount ? `Based on ${ratingCount} ratings` : null}</div>
              </span>
            </div>
          ) : null}
          <div className="pb-reviews">
            {reviews.map((review) => (
              <article key={review.id} className="pb-review">
                {review.rating ? <Stars value={review.rating} /> : null}
                <p>&ldquo;{review.text}&rdquo;</p>
                <div className="pb-review-who">
                  <span className="pb-avatar">{getInitials(review.name)}</span>
                  <span>
                    <strong>{review.name}</strong>
                    {review.verified ? <small><BadgeCheck size={13} /> Verified buyer</small> : null}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

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

export default function ProductPage() {
  return <ProductPageContent />;
}
