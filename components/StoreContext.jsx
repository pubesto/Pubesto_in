"use client";

import { createContext, useContext, useState, useEffect, useRef } from "react";
import {
  createShopifyCart,
  addToShopifyCart,
  getShopifyCartPermalink,
  getShopifyVariantIdByHandle,
  getShopifyVariantIdForColor,
} from "../lib/shopify";

const StoreContext = createContext();
const PENDING_RAZORPAY_ORDER_KEY = "pubesto_pending_razorpay_order";

function normalizeProductText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/-imported$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hasHighlights(product) {
  return Array.isArray(product?.highlights) && product.highlights.filter(Boolean).length > 0;
}

function findLocalProductFallback(shopifyProduct, localProducts) {
  const shopifySlug = normalizeProductText(shopifyProduct.slug);
  const shopifyName = normalizeProductText(shopifyProduct.name);

  return localProducts.find((localProduct) => (
    normalizeProductText(localProduct.slug) === shopifySlug ||
    normalizeProductText(localProduct.name) === shopifyName ||
    (Array.isArray(localProduct.slugAliases) && localProduct.slugAliases.map(normalizeProductText).includes(shopifySlug))
  ));
}

const COLOR_HEX_MAP = {
  "green": "#2E5A44",
  "forest green": "#2D4B3F",
  "white": "#F5F5F5",
  "arctic white": "#F5F5F5",
  "black": "#1A1A1A",
  "blue": "#3A6073",
  "pink": "#E8C2C2",
  "blush pink": "#E8C2C2",
  "orange": "#E67E22",
  "yellow": "#F1C40F",
  "silver": "#BDC3C7",
  "off-green": "#4D7C59",
};

function getVariantColorName(variant, productSlug = "") {
  const colorOpt = variant?.selectedOptions?.find(
    (opt) => opt.name.toLowerCase() === "color" || opt.name.toLowerCase() === "colour"
  );
  if (colorOpt) {
    let val = colorOpt.value;
    const slugLower = String(productSlug || "").toLowerCase();
    const variantId = String(variant?.id || "");
    const isNeckFan = slugLower.includes("neck-fan") || 
                      variantId.includes("516883083") || 
                      variantId.includes("516994722") || 
                      variantId.includes("517325554");
    
    if (isNeckFan) {
      if (val.toLowerCase() === "blue" || val.toLowerCase() === "silver") return "Arctic White";
      if (val.toLowerCase() === "black") return "Black";
      if (val.toLowerCase() === "pink") return "Blush Pink";
    }
    return val;
  }
  // Do NOT fall back to variant title — non-color variant options (sizes, features, etc.)
  // would incorrectly appear as color swatches in the UI.
  return null;
}


function mergeShopifyProductWithLocalFallback(shopifyProduct, localProducts) {
  if (!shopifyProduct) return null;
  const shopifyHandle = shopifyProduct.shopifyHandle || shopifyProduct.slug;
  const localProduct = findLocalProductFallback(shopifyProduct, localProducts || []);
  if (!localProduct) {
    return {
      ...shopifyProduct,
      shopifyHandle,
      slugAliases: Array.from(new Set([shopifyProduct.slug, shopifyHandle].filter(Boolean))),
      badge: shopifyProduct.badge || "20% OFF",
      badgeClass: shopifyProduct.badgeClass || "badge-discount",
    };
  }

  let mergedColors = undefined;
  if (shopifyProduct.variants && shopifyProduct.variants.length > 0) {
    const hasRealVariants = shopifyProduct.variants.length > 1 || 
      (shopifyProduct.variants[0] && shopifyProduct.variants[0].title !== 'Default Title');
    
    if (hasRealVariants) {
      const colorMap = new Map();
      
      for (const variant of shopifyProduct.variants) {
        const colorName = getVariantColorName(variant, shopifyHandle || shopifyProduct.slug);
        if (!colorName) continue;
        
        const normalized = colorName.toLowerCase();
        if (colorMap.has(normalized)) continue;
        
        let hex = COLOR_HEX_MAP[normalized] || "#F5F5F5";
        
        // If we have a local fallback color with the same name, use its hex
        if (localProduct && localProduct.colors) {
          const match = localProduct.colors.find(c => {
            const cName = c.name.toLowerCase();
            return cName === normalized || normalized.includes(cName) || cName.includes(normalized);
          });
          if (match) {
            hex = match.hex;
          }
        }
        
        let image = variant.image;
        if (image === shopifyProduct.image) {
          image = null;
        }
        if (!image && localProduct && localProduct.colors) {
          const match = localProduct.colors.find(c => c.name.toLowerCase() === normalized);
          if (match && match.image) {
            image = match.image;
          }
        }
        
        // Keyword & Fallback gallery match
        if (!image) {
          const gallery = shopifyProduct.gallery || [];
          let matchedImg = null;
          
          if (normalized.includes("pink") || normalized.includes("blush")) {
            matchedImg = gallery.find(url => url.toLowerCase().includes("pink") || url.includes("_21_17_"));
          } else if (normalized.includes("green") || normalized.includes("forest") || normalized.includes("black")) {
            matchedImg = gallery.find(url => url.toLowerCase().includes("green") || url.toLowerCase().includes("black") || url.includes("_21_49_"));
          } else if (normalized.includes("white") || normalized.includes("arctic") || normalized.includes("blue")) {
            matchedImg = gallery.find(url => url.toLowerCase().includes("white") || url.toLowerCase().includes("arctic") || url.toLowerCase().includes("blue") || url.includes("_24_59_"));
          }
          
          // Neck Fan specific index fallback
          if (!matchedImg && (localProduct.slug === "adjustable-bladeless-neck-fan" || shopifyHandle === "adjustable-bladeless-neck-fan")) {
            if ((normalized.includes("pink") || normalized.includes("blush")) && gallery[5]) {
              matchedImg = gallery[5];
            } else if ((normalized.includes("green") || normalized.includes("forest") || normalized.includes("black")) && gallery[6]) {
              matchedImg = gallery[6];
            } else if ((normalized.includes("white") || normalized.includes("arctic") || normalized.includes("blue")) && gallery[7]) {
              matchedImg = gallery[7];
            }
          }
          
          image = matchedImg;
        }
        
        colorMap.set(normalized, {
          name: colorName,
          hex,
          image: image || shopifyProduct.image,
          available: localProduct.inStock !== false ? true : variant.available
        });
      }
      
      if (colorMap.size > 0) {
        mergedColors = Array.from(colorMap.values());
      }
    }
  }

  if (!mergedColors && localProduct.colors) {
    mergedColors = localProduct.colors;
  }

  return {
    ...localProduct,
    ...shopifyProduct,
    slug: localProduct.slug || shopifyProduct.slug,
    shopifyHandle,
    slugAliases: Array.from(new Set([
      localProduct.slug,
      shopifyProduct.slug,
      shopifyHandle,
      ...(localProduct.slugAliases || []),
      ...(shopifyProduct.slugAliases || []),
    ].filter(Boolean))),
    inStock: localProduct.inStock === true ? true : shopifyProduct.inStock,
    highlights: hasHighlights(shopifyProduct) ? shopifyProduct.highlights : localProduct.highlights,
    specifications: shopifyProduct.specifications || localProduct.specifications,
    rating: shopifyProduct.rating || localProduct.rating,
    reviews: shopifyProduct.reviews || localProduct.reviews,
    reviewsList: (shopifyProduct.reviewsList && shopifyProduct.reviewsList.length > 0) ? shopifyProduct.reviewsList : localProduct.reviewsList,
    badge: shopifyProduct.badge || localProduct.badge || "20% OFF",
    badgeClass: shopifyProduct.badgeClass || localProduct.badgeClass || "badge-discount",
    detail: shopifyProduct.detail || localProduct.detail,
    bundleProducts: shopifyProduct.bundleProducts || localProduct.bundleProducts || [],
    categories: Array.from(new Set([
      ...(localProduct.categories || []),
      ...(shopifyProduct.categories || [])
    ])),
    colors: mergedColors
  };
}

export function StoreProvider({ children, categories: initialCategories = [], products: initialProducts = [] }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [cartPulseKey, setCartPulseKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [shopifyCart, setShopifyCart] = useState(null);
  const [products, setProducts] = useState(initialProducts);
  const [categories, setCategories] = useState(initialCategories);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [wishlist, setWishlist] = useState([]);
  const shopifyCartQueueRef = useRef(Promise.resolve());
  const cartLoadedRef = useRef(false);

  useEffect(() => {
    if (cartLoadedRef.current) {
      try {
        localStorage.setItem("pubesto_cart", JSON.stringify(cartItems));
      } catch (err) {
        console.error("Error saving cart items to localStorage:", err);
      }
    }
  }, [cartItems]);

  function getRazorpayCallbackUrl() {
    const callbackUrl = new URL("/api/razorpay/callback", window.location.origin);
    callbackUrl.searchParams.set("redirect", "/");
    return callbackUrl.toString();
  }

  function buildRazorpayOrderItems(cartSnapshot) {
    return cartSnapshot.map((cartItem) => {
      const product = cartItem.product || cartItem;
      const priceNumber = getProductBasePrice(product) || product.salePrice || product.originalPrice || 0;

      return {
        id: product.slug || cartItem.id,
        name: product.name || "Product",
        image: product.image || "/images/products/neck-fan.png",
        price: `Rs. ${priceNumber.toLocaleString("en-IN")}`,
        priceNumber,
        quantity: Math.max(1, Number(cartItem.quantity) || 1),
        slug: product.slug || "",
        color: product.selectedColor || cartItem.color || "",
      };
    });
  }

  function persistRazorpayOrder(cartSnapshot, paymentId) {
    const orderItems = buildRazorpayOrderItems(cartSnapshot || []);
    if (orderItems.length === 0) return;

    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    const subtotal = orderItems.reduce((sum, item) => sum + item.priceNumber * item.quantity, 0);
    const shipping = subtotal >= 999 ? 0 : 99;
    const newOrder = {
      id: `PUB-${year}-${rand}`,
      date: new Date().toISOString(),
      items: orderItems,
      subtotal,
      shipping,
      total: subtotal + shipping,
      status: "processing",
      paymentStatus: "paid",
      paymentId,
    };

    const existingOrders = JSON.parse(localStorage.getItem("pubesto_orders") || "[]");
    localStorage.setItem("pubesto_orders", JSON.stringify([newOrder, ...existingOrders]));
  }

  function completeRazorpayPayment(cartSnapshot, paymentId, options = {}) {
    const { redirectHome = true } = options;

    try {
      persistRazorpayOrder(cartSnapshot, paymentId);
    } catch (saveErr) {
      console.error("Could not save order to history:", saveErr);
    }

    localStorage.removeItem(PENDING_RAZORPAY_ORDER_KEY);
    localStorage.removeItem("shopify_cart");
    localStorage.removeItem("pubesto_cart");
    setCartItems([]);
    setIsCartOpen(false);
    setIsProfileOpen(false);
    setProfileNotice("Order placed successfully.");

    if (redirectHome) {
      window.location.href = "/";
    }
  }

  function handleRazorpayReturn() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "razorpay_success") return;

    let pendingOrder = null;
    try {
      pendingOrder = JSON.parse(localStorage.getItem(PENDING_RAZORPAY_ORDER_KEY) || "null");
    } catch (error) {
      console.error("Could not read pending Razorpay order:", error);
    }

    completeRazorpayPayment(
      pendingOrder?.items || [],
      params.get("razorpay_payment_id") || "",
      { redirectHome: true }
    );

    const cleanUrl = `${window.location.pathname}${window.location.hash || ""}` || "/";
    window.history.replaceState(null, "", cleanUrl);
  }

  useEffect(() => {
    async function syncShopify() {
      try {
        const [prodRes, colRes] = await Promise.all([
          fetch("/api/products"),
          fetch("/api/collections")
        ]);

        if (prodRes.ok) {
          const shopifyProducts = await prodRes.json();
          if (shopifyProducts && shopifyProducts.length > 0) {
            // Only show products that exist in Shopify, enriched with local fallback data.
            setProducts(() => {
              const localProducts = initialProducts || [];
              const merged = shopifyProducts
                .map((shopifyProduct) => mergeShopifyProductWithLocalFallback(shopifyProduct, localProducts))
                .filter(Boolean);

              return merged;
            });
          }
        }

        if (colRes.ok) {
          const shopifyCollections = await colRes.json();
          if (shopifyCollections && shopifyCollections.length > 0) {
            setCategories(shopifyCollections);
          }
        }
      } catch (error) {
        console.error("Error syncing with Shopify API proxy:", error);
      }
    }
    syncShopify();
    refreshAuthSession();

    // Wishlist Persistence
    const savedWishlist = localStorage.getItem("pubesto_wishlist");
    if (savedWishlist) {
      try {
        setWishlist(JSON.parse(savedWishlist));
      } catch (e) {
        console.error("Error parsing wishlist", e);
      }
    }

    const savedShopifyCart = localStorage.getItem("shopify_cart");
    if (savedShopifyCart) {
      try {
        setShopifyCart(JSON.parse(savedShopifyCart));
      } catch (e) {
        console.error("Error parsing Shopify cart", e);
      }
    }

    // Load Local Cart Items
    const savedCart = localStorage.getItem("pubesto_cart");
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart));
      } catch (e) {
        console.error("Error parsing cart items:", e);
      }
    }
    cartLoadedRef.current = true;

    handleRazorpayReturn();
  }, []);
  const [footerPanel, setFooterPanel] = useState(null);

  function getProductId(product) {
    const baseId = product.sku || product.slug || product.name;
    if (product.selectedColors && product.selectedColors.length > 0) {
      const sorted = [...product.selectedColors].sort();
      return `${baseId}::${sorted.join(",")}`;
    }
    return product.selectedColor ? `${baseId}::${product.selectedColor}` : baseId;
  }

  function getProductPrice(product) {
    if (typeof product.salePrice === "number") {
      return product.salePrice;
    }
    const rawPrice = String(product.price || "0").replace(/[^\d.]/g, "");
    return Number(rawPrice) || 0;
  }

  function getProductBasePrice(product) {
    if (typeof product.salePrice === "number") {
      return product.salePrice;
    }
    const original = products.find(p => p.slug === product.slug || p.sku === product.sku);
    const target = original || product;
    if (typeof target.salePrice === "number") {
      return target.salePrice;
    }
    const rawPrice = String(target.price || "0").replace(/[^\d.]/g, "");
    return Number(rawPrice) || 0;
  }

  function getProductBaseOldPrice(product) {
    if (typeof product.originalPrice === "number") {
      return product.originalPrice;
    }
    const original = products.find(p => p.slug === product.slug || p.sku === product.sku);
    const target = original || product;
    if (typeof target.originalPrice === "number") {
      return target.originalPrice;
    }
    const rawPrice = String(target.oldPrice || "0").replace(/[^\d.]/g, "");
    return Number(rawPrice) || 0;
  }

  function getCartItemTotalPrice(product, quantity) {
    const basePrice = getProductBasePrice(product);
    return basePrice * quantity;
  }

  function getCartItemTotalOldPrice(product, quantity) {
    const basePrice = getProductBasePrice(product);
    const baseOldPrice = getProductBaseOldPrice(product) || Math.round(basePrice * 1.35);
    return baseOldPrice * quantity;
  }

  function getCartItemDisplayName(product, quantity) {
    const original = products.find(p => p.slug === product.slug || p.sku === product.sku);
    const baseName = original ? original.name : product.name.replace(/\s*\([^)]+\)/g, "").trim();
    const displayBaseName = product.selectedColor ? `${baseName} - ${product.selectedColor}` : baseName;
    return displayBaseName;
  }

  function closeUtilityPanels() {
    setIsCartOpen(false);
    setIsProfileOpen(false);
  }

  function getNextCartItems(items, product, quantity) {
    const productId = getProductId(product);
    const existingItem = items.find((item) => item.id === productId);

    if (existingItem) {
      return items.map((item) =>
        item.id === productId ? { ...item, quantity: item.quantity + quantity } : item
      );
    }

    return [...items, { id: productId, product, quantity }];
  }

  function openShopifyCart(items = cartItems) {
    setIsCartOpen(true);
  }

  async function resolveShopifyCartProduct(product) {
    if (product.shopifyVariantId || product.variantId || product.sku?.includes("gid://shopify/")) {
      return product;
    }

    const handle = product.shopifyHandle || product.slug;
    if (!handle) return product;

    try {
      const shopifyVariantId = await getShopifyVariantIdByHandle(handle);
      return shopifyVariantId ? { ...product, shopifyVariantId } : product;
    } catch (error) {
      console.error("Shopify variant lookup failed:", error);
      return product;
    }
  }

  async function refreshAuthSession() {
    setIsAuthLoading(true);
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      const data = await response.json();
      const nextUser = data?.user || null;
      setUser(nextUser);
      setIsLoggedIn(Boolean(nextUser));
      return nextUser;
    } catch (error) {
      console.error("Error loading auth session:", error);
      setUser(null);
      setIsLoggedIn(false);
      return null;
    } finally {
      setIsAuthLoading(false);
    }
  }

  function login(userData) {
    const nextUser = typeof userData === "string"
      ? { email: userData, name: "Pubesto Customer" }
      : userData;
    setUser(nextUser);
    setIsLoggedIn(Boolean(nextUser));
    setProfileNotice("Successfully signed in!");
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Error logging out:", error);
    }
    setUser(null);
    setIsLoggedIn(false);
    setProfileNotice("Logged out successfully.");
  }

  function addToWishlist(product) {
    setWishlist((prev) => {
      if (prev.find((p) => p.slug === product.slug)) return prev;
      const next = [...prev, product];
      localStorage.setItem("pubesto_wishlist", JSON.stringify(next));
      return next;
    });
  }

  function removeFromWishlist(productSlug) {
    setWishlist((prev) => {
      const next = prev.filter((p) => p.slug !== productSlug);
      localStorage.setItem("pubesto_wishlist", JSON.stringify(next));
      return next;
    });
  }

  async function addToCart(product, options = {}) {
    const shouldOpenCart = options.openCart !== false;

    const addQuantity = options.quantity || 1;
    const selectedColor = options.color || product.selectedColor || "";
    const selectedColors = options.selectedColors || product.selectedColors || null;
    const resolvedProduct = await resolveShopifyCartProduct(product);
    let cartProduct = selectedColor
      ? { ...resolvedProduct, selectedColor }
      : resolvedProduct;
      
    if (selectedColors && selectedColors.length > 0) {
      cartProduct = { ...cartProduct, selectedColors };
    }
    
    const nextCartItems = getNextCartItems(cartItems, cartProduct, addQuantity);

    setCartItems(nextCartItems);
    setCartPulseKey((key) => key + 1);
    setIsProfileOpen(false);
    setIsCartOpen(false);
    
    // Shopify Sync
    if (!selectedColors || selectedColors.length === 0) {
      let shopifyVariantId = null;
      if (selectedColor && cartProduct.variants && cartProduct.variants.length > 0) {
        const matchedVariant = cartProduct.variants.find(v => {
          const vColor = getVariantColorName(v, cartProduct.slug || cartProduct.shopifyHandle);
          return vColor && vColor.toLowerCase() === selectedColor.toLowerCase();
        });
        if (matchedVariant) {
          shopifyVariantId = matchedVariant.id;
        }
      }
      if (!shopifyVariantId) {
        shopifyVariantId = getShopifyVariantIdForColor(cartProduct.slug, selectedColor) || 
                           cartProduct.shopifyVariantId || cartProduct.variantId || cartProduct.sku;
      }

      if (process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN && shopifyVariantId?.includes('gid://shopify/')) {
        handleShopifyAddToCart({ ...cartProduct, sku: shopifyVariantId }, addQuantity);
      }
    }

    if (shouldOpenCart) {
      openShopifyCart(nextCartItems);
    }
  }

  async function handleShopifyAddToCart(product, quantity = 1) {
    // Queue ensures Shopify cart mutations run sequentially, preventing CONFLICT errors
    shopifyCartQueueRef.current = shopifyCartQueueRef.current.then(async () => {
      try {
        let currentCart = shopifyCart;
        if (!currentCart) {
          currentCart = await createShopifyCart();
          setShopifyCart(currentCart);
          localStorage.setItem("shopify_cart", JSON.stringify(currentCart));
        }
        try {
          const updatedCart = await addToShopifyCart(currentCart.id, product.sku, quantity);
          setShopifyCart(updatedCart);
          localStorage.setItem("shopify_cart", JSON.stringify(updatedCart));
        } catch (conflictError) {
          // On CONFLICT, create a fresh cart and retry once
          if (String(conflictError).includes('CONFLICT') || String(conflictError).includes('conflicted')) {
            console.warn("Shopify cart conflict, creating fresh cart and retrying...");
            const freshCart = await createShopifyCart();
            const retryCart = await addToShopifyCart(freshCart.id, product.sku, quantity);
            setShopifyCart(retryCart);
            localStorage.setItem("shopify_cart", JSON.stringify(retryCart));
          } else {
            throw conflictError;
          }
        }
      } catch (error) {
        console.warn("Shopify Storefront Cart API unavailable (bypassed):", error.message || error);
      }
    });
    return shopifyCartQueueRef.current;
  }

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

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

  async function checkout(options = {}) {
    const activeItems = options.items || cartItems;
    const activeAmount = options.amount || cartTotal;

    if (activeItems.length === 0) return;

    const refreshedUser = await refreshAuthSession();
    const checkoutUser = refreshedUser || user;

    // Generate standard Storefront Cart permalink checkout (/cart/variantId:qty)
    // This forces Shopify to display the native "Discount code" box on the checkout page
    try {
      const permalinkUrl = getShopifyCartPermalink(activeItems);
      if (permalinkUrl) {
        window.location.href = appendCheckoutPrefillParams(permalinkUrl, checkoutUser);
        return;
      }
    } catch (error) {
      console.error("Shopify cart permalink redirect failed:", error);
    }

    // Fallback 2: Fallback to Razorpay for local-only items
    const res = await loadRazorpay();
    if (!res) {
      alert("Razorpay SDK failed to load. Are you online?");
      return;
    }

    try {
      const finalAmount = activeAmount + (activeAmount >= 999 ? 0 : 99);
      const response = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: finalAmount }),
      });

      const order = await response.json();
      if (order.error) throw new Error(order.error);

      const cartSnapshot = activeItems.map((item) => ({
        ...item,
        product: item.product ? { ...item.product } : item.product,
      }));

      try {
        localStorage.setItem(PENDING_RAZORPAY_ORDER_KEY, JSON.stringify({
          razorpayOrderId: order.id,
          amount: finalAmount,
          items: cartSnapshot,
          createdAt: new Date().toISOString(),
        }));
      } catch (saveErr) {
        console.error("Could not save pending Razorpay order:", saveErr);
      }

      const rzpOptions = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_RwcLAPO7q0AESo",
        amount: order.amount,
        currency: order.currency,
        name: "Pubesto",
        description: "Artisanal Ecommerce",
        order_id: order.id,
        callback_url: getRazorpayCallbackUrl(),
        redirect: true,
        handler: function (response) {
          completeRazorpayPayment(cartSnapshot, response.razorpay_payment_id);
        },
        prefill: {
          name: checkoutUser?.name || "Customer",
          email: checkoutUser?.email === "amitsharma500677@gmail.com" ? "pubesto.in@gmail.com" : (checkoutUser?.email || "pubesto.in@gmail.com"),
          contact: checkoutUser?.phone || "9999999999",
        },
        theme: { color: "#1b624b" },
      };

      const paymentObject = new window.Razorpay(rzpOptions);
      paymentObject.open();
    } catch (error) {
      console.error("Checkout Error:", error);
      alert("Checkout failed. Please try again.");
    }
  }

  function updateCartQuantity(productId, nextQuantity) {
    setCartItems((items) => {
      if (nextQuantity <= 0) {
        return items.filter((item) => item.id !== productId);
      }
      return items.map((item) => (item.id === productId ? { ...item, quantity: nextQuantity } : item));
    });
  }

  function removeFromCart(productId) {
    setCartItems((items) => items.filter((item) => item.id !== productId));
  }

  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cartItems.reduce((total, item) => total + getCartItemTotalPrice(item.product, item.quantity), 0);
  const shopifyCartUrl = getShopifyCartPermalink(cartItems);

  const value = {
    isMenuOpen, setIsMenuOpen,
    isCartOpen, setIsCartOpen,
    isProfileOpen, setIsProfileOpen,
    isSearchOpen, setIsSearchOpen,
    cartItems, setCartItems,
    cartPulseKey, setCartPulseKey,
    searchQuery, setSearchQuery,
    profileNotice, setProfileNotice,
    selectedCategory, setSelectedCategory,
    showAllProducts, setShowAllProducts,
    footerPanel, setFooterPanel,
    cartCount, cartTotal,
    shopifyCartUrl, openShopifyCart,
    getProductId, getProductPrice,
    getCartItemTotalPrice, getCartItemTotalOldPrice, getCartItemDisplayName,
    closeUtilityPanels, addToCart, updateCartQuantity, removeFromCart, checkout,
    categories, products,
    footerPanel, setFooterPanel,
    isLoggedIn, setIsLoggedIn, isAuthLoading,
    user, setUser,
    wishlist, setWishlist,
    login, logout, refreshAuthSession, addToWishlist, removeFromWishlist
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
}
