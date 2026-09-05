"use client";

import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, ChevronDown, Check, Plus, Minus, ArrowRight, ShieldCheck, Sparkles, ChevronRight, CheckSquare, Tag, Undo2, Volume2, VolumeX, X, Star } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useStore } from "../../../components/StoreContext";
import { peopleChoiceVideos } from "../../../lib/data";
import { getShopifyCheckoutUrl, getShopifyVariantIdForColor, getShopifyCartPermalink } from "../../../lib/shopify";

const INDIAN_NAMES = [
  "Rahul", "Kavya", "Vivek", "Sunita", "Srinivas", "Priya", "Amit", "Riya", 
  "Deepa", "Harish", "Ananya", "Vikram", "Sneha", "Rohan", "Pooja", "Arjun", 
  "Karan", "Neha", "Aditya", "Manish", "Shikha", "Aman", "Rajesh", "Meera", 
  "Suresh", "Divya", "Sanjay", "Komal", "Abhishek", "Preeti"
];

const INDIAN_CITIES = [
  "Mumbai", "Delhi", "Bangalore", "Pune", "Hyderabad", "Chennai", "Kolkata", 
  "Ahmedabad", "Gurgaon", "Noida", "Jaipur", "Lucknow", "Chandigarh", "Surat", 
  "Kochi", "Indore", "Patna", "Bhopal", "Visakhapatnam", "Coimbatore"
];

const getDeterministicSales = (prod) => {
  if (!prod) return 1100;
  const hash = (prod.slug || prod.name || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return 850 + (hash % 650); // Generates between 850 and 1500
};

const getDeterministicStock = (prod, colorName) => {
  if (!prod) return 8;
  const key = (prod.slug || "") + (colorName || "");
  const hash = key.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return 5 + (hash % 10); // Generates between 5 and 14
};

function productMatchesRouteSlug(product, routeSlug) {
  const target = String(routeSlug || "").toLowerCase();
  if (!product || !target) return false;

  const candidates = [
    product.slug,
    product.shopifyHandle,
    product.handle,
    ...(product.slugAliases || []),
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return candidates.includes(target) || candidates.some((candidate) => candidate.includes(target));
}

const parsePrice = (priceStr) => {
  const num = Number((priceStr || '').replace(/[^\d.]/g, ''));
  return isNaN(num) || num === 0 ? null : num;
};

const formatRupeePrice = (priceStr) => {
  if (!priceStr) return "";
  return priceStr.replace(/(Rs\.|Rs|RS|INR)\s*/gi, "₹");
};

function ProductPageContent() {
  const { slug } = useParams();
  const { 
    addToCart, cartItems, getProductId, getProductPrice, products, updateCartQuantity, checkout, setIsCartOpen, isLoggedIn, isAuthLoading, user, refreshAuthSession
  } = useStore();
  const [activeTab, setActiveTab] = useState("specs");
  const [addEffectKey, setAddEffectKey] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState(null);
  const [activeImage, setActiveImage] = useState(null);
  const [videoSoundOn, setVideoSoundOn] = useState(false);
  const [isBuyingNow, setIsBuyingNow] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [couponSuccess, setCouponSuccess] = useState("");

  // Dynamic ticker states
  const [unitsSold, setUnitsSold] = useState(1100);
  const [stockCount, setStockCount] = useState(8);
  const [activeViewers, setActiveViewers] = useState(24);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [lastBuyer, setLastBuyer] = useState({ name: "Rahul", city: "Mumbai", qty: 2 });

  useEffect(() => {
    // Force scroll to top with a slight delay to ensure content is ready
    const timer = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, 10);
    
    // Initialize product states
    const product = products.find((p) => productMatchesRouteSlug(p, slug));
    if (product) {
      if (product.colors && product.colors.length > 0) {
        // If current selectedColor is not in new product.colors, reset to first color
        const isCurrentColorValid = selectedColor && product.colors.some(
          (c) => c.name.toLowerCase() === selectedColor.name.toLowerCase()
        );
        
        if (!isCurrentColorValid) {
          setSelectedColor(product.colors[0]);
          if (product.colors[0].image) {
            setActiveImage(product.colors[0].image);
          } else {
            setActiveImage(product.image);
          }
        } else {
          // Keep existing color but update its reference from the new list
          const matched = product.colors.find(
            (c) => c.name.toLowerCase() === selectedColor.name.toLowerCase()
          );
          setSelectedColor(matched);
        }
      } else {
        setSelectedColor(null);
        setActiveImage(product.image);
      }
    }
    
    return () => clearTimeout(timer);
  }, [slug, products]);

  const product = products.find((p) => productMatchesRouteSlug(p, slug));

  const productColors = product && Array.isArray(product.colors)
    ? product.colors.filter((color) => color && color.name && color.hex)
    : [];
  const selectedColorName = selectedColor?.name || productColors[0]?.name || "";
  const basePrice = product ? (product.salePrice || parsePrice(product.price) || 599) : 599;
  const baseOldPrice = product ? (product.originalPrice || parsePrice(product.oldPrice) || Math.round(basePrice * 1.35)) : 809;

  // Initialize and update ticker data based on product
  useEffect(() => {
    if (product) {
      const sales = getDeterministicSales(product);
      setUnitsSold(sales);
      
      const hash = (product.slug || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
      setActiveViewers(12 + (hash % 20));
      
      const initialColor = product.colors && product.colors.length > 0 ? product.colors[0].name : "";
      setStockCount(getDeterministicStock(product, initialColor));
    }
  }, [product]);

  // Update variant stock levels when color is changed
  useEffect(() => {
    if (product && selectedColor) {
      setStockCount(getDeterministicStock(product, selectedColor.name));
    }
  }, [selectedColor, product]);

  // Periodically increment sales and toggle viewer count / stock levels
  useEffect(() => {
    if (!product) return;
    
    const interval = setInterval(() => {
      // Randomly increment units sold
      const increment = Math.random() > 0.5 ? 2 : 1;
      setUnitsSold(prev => prev + increment);
      
      // Select new buyer details
      const randomName = INDIAN_NAMES[Math.floor(Math.random() * INDIAN_NAMES.length)];
      const randomCity = INDIAN_CITIES[Math.floor(Math.random() * INDIAN_CITIES.length)];
      const randomQty = Math.random() > 0.7 ? 4 : (Math.random() > 0.4 ? 2 : 1);
      
      setLastBuyer({
        name: randomName,
        city: randomCity,
        qty: randomQty
      });
      
      // Randomly toggle viewers slightly
      setActiveViewers(prev => {
        const change = Math.floor(Math.random() * 5) - 2; // -2 to +2
        return Math.max(8, prev + change);
      });
      
      // Randomly decrement stock count occasionally
      if (Math.random() > 0.75) {
        setStockCount(prev => Math.max(2, prev - 1));
      }
    }, 12000 + Math.random() * 6000); // 12-18s
    
    return () => clearInterval(interval);
  }, [product]);

  // Cycle through ticker messages
  useEffect(() => {
    const interval = setInterval(() => {
      setTickerIndex(prev => (prev + 1) % 4);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Auto-checkout if buy_now query param is present and user is logged in
  useEffect(() => {
    if (isAuthLoading || !isLoggedIn || !product) return;

    const params = new URLSearchParams(window.location.search);
    const buyNow = params.get("buy_now");
    if (buyNow === "true") {
      const qtyParam = parseInt(params.get("qty") || "1", 10);
      const colorParam = params.get("color");

      // Set state to match query parameters so user sees the color & qty they selected
      if (qtyParam > 0) {
        setQuantity(qtyParam);
      }
      if (colorParam && product.colors) {
        const matched = product.colors.find(c => c.name.toLowerCase() === colorParam.toLowerCase());
        if (matched) {
          setSelectedColor(matched);
          setActiveImage(matched.image || product.image);
        }
      }

      // Clear query parameters from URL so refreshing won't trigger buy now again
      const newUrl = window.location.pathname;
      window.history.replaceState(null, "", newUrl);

      // Trigger checkout immediately
      handleBuyNow(qtyParam, colorParam || selectedColorName);
    }
  }, [isAuthLoading, isLoggedIn, product, selectedColorName]);

  if (!product) {
    return (
      <div className="error-page">
        <h1>Product not found</h1>
        <Link href="/">Return to Home</Link>
      </div>
    );
  }

  const cartQuantity = cartItems.find((item) => item.id === getProductId(product))?.quantity || 0;

  function handleAddToCart() {
    if (product.inStock === false) return;

    const nextKey = Date.now();
    setAddEffectKey(nextKey);
    window.setTimeout(() => {
      setAddEffectKey((currentKey) => (currentKey === nextKey ? null : currentKey));
    }, 1050);

    // Pass the selected options and quantity
    addToCart(product, {
      color: selectedColorName,
      quantity: quantity 
    });
  }

  function appendCheckoutPrefillParams(url, currentUser = user) {
    if (!url) return url;
    try {
      const parsedUrl = new URL(url, window.location.origin);
      
      const email = currentUser?.email;
      if (email) {
        parsedUrl.searchParams.set("checkout[email]", email);
      }
      
      // Split name
      const nameParts = String(currentUser?.name || "Customer").trim().split(/\s+/);
      const firstName = nameParts[0] || "Customer";
      const lastName = nameParts.slice(1).join(" ") || ".";
      
      parsedUrl.searchParams.set("checkout[shipping_address][first_name]", firstName);
      parsedUrl.searchParams.set("checkout[shipping_address][last_name]", lastName);
      
      if (currentUser?.phone) {
        const digits = String(currentUser.phone).replace(/\D/g, "");
        const formattedPhone = digits.length === 10 ? `+91${digits}` : (currentUser.phone.startsWith("+") ? currentUser.phone : null);
        if (formattedPhone) {
          parsedUrl.searchParams.set("checkout[shipping_address][phone]", formattedPhone);
        }
      }
      
      if (currentUser?.addresses && currentUser.addresses.length > 0) {
        const addr = currentUser.addresses[0];
        if (addr.line1) parsedUrl.searchParams.set("checkout[shipping_address][address1]", addr.line1);
        if (addr.line2) parsedUrl.searchParams.set("checkout[shipping_address][address2]", addr.line2);
        if (addr.city) parsedUrl.searchParams.set("checkout[shipping_address][city]", addr.city);
        if (addr.state) parsedUrl.searchParams.set("checkout[shipping_address][province]", addr.state);
        if (addr.pincode) parsedUrl.searchParams.set("checkout[shipping_address][zip]", addr.pincode);
        parsedUrl.searchParams.set("checkout[shipping_address][country]", "India");
      }
      
      return parsedUrl.toString();
    } catch (e) {
      console.error("Failed to append checkout prefill parameters:", e);
      return url;
    }
  }

  async function handleBuyNow(overrideQty = null, overrideColor = null) {
    if (product.inStock === false || isBuyingNow) return;

    const currentQty = overrideQty !== null ? overrideQty : quantity;
    const currentColorName = overrideColor !== null ? overrideColor : selectedColorName;

    // Check if user is logged in
    if (!isLoggedIn) {
      // Store current product page URL with query params for auto-checkout after signup
      const redirectUrl = `${window.location.pathname}?buy_now=true&qty=${currentQty}&color=${encodeURIComponent(currentColorName)}`;
      window.location.href = `/account/login?mode=signup&redirect=${encodeURIComponent(redirectUrl)}`;
      return;
    }

    const shopifyHandle = product.shopifyHandle || product.slug;
    setIsBuyingNow(true);

    try {
      const refreshedUser = await refreshAuthSession?.();
      const checkoutUser = refreshedUser || user;

      // Generate standard Storefront Cart permalink checkout (/cart/variantId:qty)
      // This forces Shopify to display the native "Discount code" box on the checkout page
      const permalinkUrl = getShopifyCartPermalink([{
        product,
        color: currentColorName,
        quantity: currentQty
      }]);

      window.location.href = appendCheckoutPrefillParams(permalinkUrl, checkoutUser);
      return;
    } catch (err) {
      console.warn("Shopify checkout error:", err.message);
      
      addToCart(product, {
        color: currentColorName,
        quantity: currentQty,
        openCart: false
      });
      const fallbackProduct = currentColorName
        ? { ...product, selectedColor: currentColorName }
        : product;
      checkout({
        items: [{ id: getProductId(fallbackProduct), product: fallbackProduct, quantity: currentQty }],
        amount: basePrice * currentQty
      });
    } finally {
      setIsBuyingNow(false);
    }
  }

  function adjustQuantity(amount) {
    setQuantity(prev => Math.max(1, prev + amount));
  }

  function openCustomizationPopup(bundleId) {
    const colors = Array.isArray(product.colors) ? product.colors.filter(c => c && c.name && c.hex) : [];
    if (colors.length === 0) {
      return; // Bypass popup entirely if product has no color options
    }
    const size = bundleId === 1 ? 1 : bundleId; // bundleId is 1, 2, or 4
    const nextColors = normalizeBundleColors(bundleColorSelections[size], size);
    setPopupBundleSize(size);
    setPopupColors(nextColors);
    setPopupQuantity(1);
    setBundlePopupError("");
    setBundlePopupNotice("");
    setIsBundlePopupOpen(true);
  }

  // Related products (Curated Companions) - prioritizing the 4 curated companions in image 2
  const preferredSlugs = [
    "b-65-do-your-best-notebook-bottle",
    "arctic-air-ultra-cooler",
    "mini-portable-wall-mounted-ac",
    "mist-double-headed-led-fan",
    "adjustable-bladeless-neck-fan",
    "mini-mist-cooling-fan"
  ];

  let relatedProducts = preferredSlugs
    .filter((slug) => slug !== product.slug)
    .map((slug) => products.find((p) => p.slug === slug || (p.slugAliases && p.slugAliases.includes(slug))))
    .filter(Boolean)
    .slice(0, 4);

  if (relatedProducts.length < 4) {
    const remaining = products.filter((p) => p.slug !== product.slug && !relatedProducts.some((rp) => rp.slug === p.slug));
    relatedProducts = [...relatedProducts, ...remaining].slice(0, 4);
  }

  const getCompanionDealLabel = (item) => {
    const sale = item.salePrice || parsePrice(item.price);
    const original = item.originalPrice || parsePrice(item.oldPrice);
    if (sale && original && original > sale) {
      return `${Math.round(((original - sale) / original) * 100)}% OFF`;
    }
    return item.badge || "Handpicked";
  };

  const getCompanionMeta = (item) => {
    if (Array.isArray(item.highlights) && item.highlights[0]) return item.highlights[0];
    if (item.detail) return item.detail;
    return "Premium daily essential";
  };

  const productHighlights = Array.isArray(product.highlights) && product.highlights.filter(Boolean).length > 0
    ? product.highlights.filter(Boolean)
    : ["Premium Quality", "Artisanal Design", "Durability Guaranteed"];

  const FREE_SHIPPING_THRESHOLD = 500;
  const SHIPPING_FEE = 70;

  const getShippingSubtext = (price, label = "") => {
    const shippingText = price >= FREE_SHIPPING_THRESHOLD
      ? "Free Priority Shipping"
      : `+ ₹${SHIPPING_FEE} Shipping (Free above ₹${FREE_SHIPPING_THRESHOLD})`;
    return label ? `${label} | ${shippingText}` : shippingText;
  };

  const displayBadge = product.inStock === false ? 'OUT OF STOCK' : product.badge;
  const displayBadgeClass = product.inStock === false ? 'badge-out-of-stock' : (product.badgeClass || 'badge-discount');

  function handleColorSelect(color) {
    if (!color || color.available === false) return;

    setSelectedColor(color);
    setActiveImage(color.image || product.image);
  }

  function handleThumbnailClick(img) {
    setActiveImage(img);
    if (productColors && productColors.length > 0) {
      const matchedColor = productColors.find(c => c.image === img);
      if (matchedColor) {
        setSelectedColor(matchedColor);
      }
    }
  }

  function getSelectedProductName() {
    return selectedColorName ? `${product.name} - ${selectedColorName}` : product.name;
  }

  function renderReviewStars(rating, size = 14) {
    const rounded = Math.round(Number(rating || 0));
    return [0, 1, 2, 3, 4].map((index) => (
      <Star
        key={index}
        size={size}
        fill={index < rounded ? "currentColor" : "none"}
        strokeWidth={2}
      />
    ));
  }

  const tickerMessages = [
    {
      id: "sales",
      content: (
        <span>
          <strong>
            <motion.span
              key={unitsSold}
              initial={{ scale: 1.25, color: "#ef4444" }}
              animate={{ scale: 1, color: "#1f2937" }}
              style={{ display: "inline-block" }}
              transition={{ duration: 0.4, type: "spring", stiffness: 200 }}
            >
              {unitsSold}+ units sold
            </motion.span>
          </strong> in the last 24 hours
        </span>
      )
    },
    {
      id: "live",
      content: (
        <span>
          🔥 <strong>{lastBuyer.name}</strong> from <strong>{lastBuyer.city}</strong> just bought <strong>{lastBuyer.qty} {lastBuyer.qty > 1 ? "units" : "unit"}</strong>!
        </span>
      )
    },
    {
      id: "stock",
      content: (
        <span>
          ⚡ <strong>High Demand:</strong> Only <strong>{stockCount}</strong> left in stock {selectedColorName ? `for ${selectedColorName}` : ""}!
        </span>
      )
    },
    {
      id: "viewers",
      content: (
        <span>
          ✨ <strong>{activeViewers} people</strong> are viewing this product right now
        </span>
      )
    }
  ];

  return (
    <motion.main 
      className="product-details-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="product-hero-container">
        <div className="product-gallery">
          <div className="main-image-wrapper">
            <motion.div 
              className="main-image"
              key={activeImage}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="image-glow" />
              <img
                src={activeImage || product.image}
                alt={product.name}
                loading="eager"
                decoding="async"
              />
              {displayBadge && <span className={`product-status-badge ${displayBadgeClass}`}>{displayBadge}</span>}
            </motion.div>
          </div>
          
          {product.gallery && product.gallery.length > 1 && (
            <div className="thumbnail-strip">
              {product.gallery.map((img, idx) => (
                <div 
                  key={idx} 
                  className={`thumb-item ${activeImage === img ? 'active' : ''}`}
                  onClick={() => handleThumbnailClick(img)}
                  style={{ position: 'relative' }}
                >
                  <img src={img} alt="thumbnail" loading="lazy" decoding="async" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="product-info-panel">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >


            <h1 className="product-title bold-title">{product.name}</h1>


            
            <div className="price-display-v2">
              <span className="current-price">Rs. {basePrice}</span>
              <span className="old-price">Rs. {baseOldPrice}</span>
              {baseOldPrice - basePrice > 0 && (
                <span className="discount-tag">SAVE Rs. {baseOldPrice - basePrice}</span>
              )}
            </div>

            <div className="shipping-dynamic-notice" style={{ fontSize: "14px", fontWeight: "600", marginTop: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
              {(basePrice * quantity) >= FREE_SHIPPING_THRESHOLD ? (
                <span style={{ color: "var(--brand-color)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <Check size={16} strokeWidth={3} /> Free Priority Shipping Eligible
                </span>
              ) : (
                <span style={{ color: "#c27803", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  🚚 Add Rs. {FREE_SHIPPING_THRESHOLD - (basePrice * quantity)} more for Free Shipping (Current: +₹{SHIPPING_FEE} Shipping)
                </span>
              )}
            </div>

            <p className="product-short-desc">
              {product.description}
            </p>

            {productColors.length > 0 && (
              <div className="variant-selector">
                <p className="variant-label">
                  Select Color: <span>{selectedColorName}</span>
                </p>
                <div className="color-options" role="radiogroup" aria-label="Select product color">
                  {productColors.map((color, i) => {
                    const isActive = selectedColor ? selectedColor.name === color.name : i === 0;
                    const isUnavailable = color.available === false;
                    return (
                      <button 
                        key={color.name} 
                        className={`color-bubble ${isActive ? 'active' : ''} ${isUnavailable ? 'is-disabled' : ''}`}
                        style={{ "--swatch-color": color.hex }}
                        title={isUnavailable ? `${color.name} unavailable` : color.name}
                        type="button"
                        role="radio"
                        aria-label={`${color.name}${isUnavailable ? " unavailable" : ""}`}
                        aria-checked={isActive}
                        disabled={isUnavailable}
                        onClick={() => handleColorSelect(color)}
                      >
                        {isActive ? <Check size={14} strokeWidth={3} /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="product-highlights-v2">
              <h4>Key Highlights</h4>
              <div className="highlights-chips">
                {productHighlights.map((h, i) => (
                  <span key={i} className="highlight-chip">{h}</span>
                ))}
              </div>
            </div>

            <div className="marketing-banners">
              <div className="banner-green">
                <ShieldCheck size={14} className="banner-icon-secure" strokeWidth={2.5} />
                <span>100% Secure Payments — UPI, NetBanking & Cards!</span>
              </div>
              <div className="banner-text">
                <Sparkles size={14} className="banner-icon-sparkles" strokeWidth={2.5} />
                <span>SUMMER SALE — BEST PRICE GUARANTEED!</span>
              </div>
            </div>

            <div className="units-sold-ticker" style={{ overflow: "hidden", display: "inline-flex", alignItems: "center", width: "100%", minHeight: "42px" }}>
              <div className="pulsing-dot" style={{ flexShrink: 0 }}></div>
              <div style={{ flex: 1, overflow: "hidden", position: "relative", minHeight: "20px", display: "flex", alignItems: "center" }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tickerIndex}
                    initial={{ y: 15, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -15, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    {tickerMessages[tickerIndex].content}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Quantity Selector & Purchase Actions */}
            <div className="purchase-section" style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="quantity-selector-v2" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="quantity-label" style={{ fontSize: '14px', fontWeight: '700', color: 'var(--brand-color)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Quantity:</span>
                <div className="quantity-controls" style={{ display: 'flex', alignItems: 'center', background: 'var(--panel)', border: '1px solid rgba(211, 201, 189, 0.5)', borderRadius: '999px', padding: '4px' }}>
                  <button 
                    type="button"
                    onClick={() => adjustQuantity(-1)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', border: 'none', background: 'none', color: 'var(--ink)', cursor: 'pointer', borderRadius: '50%' }}
                    aria-label="Decrease quantity"
                  >
                    <Minus size={14} strokeWidth={2.5} />
                  </button>
                  <span className="quantity-number" style={{ minWidth: '24px', textAlign: 'center', fontSize: '14px', fontWeight: '700', color: 'var(--ink)' }}>{quantity}</span>
                  <button 
                    type="button"
                    onClick={() => adjustQuantity(1)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', border: 'none', background: 'none', color: 'var(--ink)', cursor: 'pointer', borderRadius: '50%' }}
                    aria-label="Increase quantity"
                  >
                    <Plus size={14} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              <div className="purchase-actions-v2 product-buy-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button 
                  className="block-btn"
                  type="button"
                  onClick={() => handleAddToCart()}
                  disabled={product.inStock === false}
                >
                  <ShoppingBag size={18} strokeWidth={2.2} />
                  <span>Add to cart</span>
                </button>

                <button 
                  className={`buy-now-btn ${isBuyingNow ? 'loading' : ''}`} 
                  type="button"
                  onClick={() => handleBuyNow()}
                  disabled={isBuyingNow || product.inStock === false}
                >
                  <span className="buy-text">{isBuyingNow ? 'Redirecting...' : 'BUY NOW'}</span>
                  {isBuyingNow ? (
                    <div className="buy-now-spinner" />
                  ) : (
                    <ChevronRight size={20} />
                  )}
                </button>

                {product.inStock === false && (
                  <div className="out-of-stock-notice-banner">
                    ⚠️ Out of Stock — Currently Unavailable
                  </div>
                )}
              </div>
            </div>


            <div className="trust-features-grid">
              <div className="trust-feature secure-pay">
                <div className="tf-icon"><ShieldCheck size={28} strokeWidth={1.6} /></div>
                <span>100% Secure<br/>Payments</span>
              </div>
              <div className="trust-feature priority-ship">
                <div className="tf-icon"><Tag size={28} strokeWidth={1.6} /></div>
                <span>Priority<br/>Dispatch</span>
              </div>
              <div className="trust-feature returns-policy">
                <div className="tf-icon"><Undo2 size={28} strokeWidth={1.6} /></div>
                <span>7-Day Worry<br/>Free Returns</span>
              </div>
            </div>

            {product.specifications && Object.keys(product.specifications).length > 0 && (
            <div className="details-accordion-v2">
              <div className="acc-item">
                <button className="acc-trigger" onClick={() => setActiveTab(activeTab === 'specs' ? '' : 'specs')}>
                  Technical Specifications
                  <Plus size={18} className={activeTab === 'specs' ? 'rotate' : ''} />
                </button>
                <AnimatePresence>
                  {activeTab === 'specs' && (
                    <motion.div 
                      className="acc-body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                    >
                      <div className="specs-table">
                        {Object.entries(product.specifications).map(([k, v], i) => (
                          <div key={i} className="spec-row-v2">
                            <span className="spec-key">{k}</span>
                            <span className="spec-val">{v}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            )}
          </motion.div>
      </div>
    </div>

    {/* Product Video Section */}
    {(() => {
      const productVideo = peopleChoiceVideos.find(v => v.slug === slug);
      if (!productVideo || !productVideo.video) return null;

      return (
        <section className="product-video-section">
          <div className="section-heading centered">
            <p className="eyebrow">Product in action</p>
            <h2>See it for yourself</h2>
          </div>
          <div className="product-video-container">
            <video 
              className="product-detail-video" 
              autoPlay 
              muted={!videoSoundOn} 
              loop 
              playsInline 
              preload="auto"
            >
              <source src={productVideo.video} type="video/mp4" />
            </video>
            <button
              className={`product-video-sound ${videoSoundOn ? "is-active" : ""}`}
              type="button"
              onClick={() => setVideoSoundOn(!videoSoundOn)}
              title={videoSoundOn ? "Mute video" : "Unmute video"}
            >
              {videoSoundOn ? <Volume2 size={24} /> : <VolumeX size={24} />}
            </button>
            <div className="video-overlay-gradient" />
          </div>
        </section>
      );
    })()}

    <motion.section
      className="curated-companions curated-companions-premium"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
      >
        <div className="curated-shell">
          <div className="curated-header">
            <div className="section-heading">
              <p className="eyebrow">DISCOVER MORE</p>
              <h2>Curated Companions</h2>
            </div>
          </div>
          <div className="companions-grid curated-grid">
            {relatedProducts.map((p, i) => {
              const pCartQty = cartItems.find((item) => item.id === getProductId(p))?.quantity || 0;
              return (
                <motion.article
                  className="curated-product-card"
                  key={p.slug}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <Link className="curated-media" href={`/product/${p.slug}`} aria-label={`View ${p.name}`}>
                    <img src={p.image} alt={p.name} loading="lazy" fetchPriority="low" decoding="async" />
                    <span className="curated-deal">{getCompanionDealLabel(p)}</span>
                  </Link>
                  <div className="curated-product-body">
                    <Link className="curated-title-link" href={`/product/${p.slug}`}>
                      <h3>{p.name}</h3>
                    </Link>
                    <div className="curated-price-row">
                      <p className="price">
                        {formatRupeePrice(p.price)}
                        {p.oldPrice ? <span>{formatRupeePrice(p.oldPrice)}</span> : null}
                      </p>
                    </div>
                    {p.inStock === false ? (
                      <button className="quick-add disabled" disabled>Out of Stock</button>
                    ) : pCartQty > 0 ? (
                      <div className="product-quantity-selector curated-quantity-selector">
                        <button 
                          type="button" 
                          onClick={() => updateCartQuantity(getProductId(p), pCartQty - 1)}
                          aria-label="Decrease quantity"
                        >
                          <Minus size={16} />
                        </button>
                        <span>{pCartQty}</span>
                        <button 
                          type="button" 
                          onClick={() => updateCartQuantity(getProductId(p), pCartQty + 1)}
                          aria-label="Increase quantity"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="quick-add curated-quick-add"
                        type="button"
                        onClick={() => addToCart(p)}
                      >
                        Add to Cart
                      </button>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </motion.section>


    </motion.main>
  );
}

export default function ProductPage() {
  return <ProductPageContent />;
}
