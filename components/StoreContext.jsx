"use client";

import { createContext, useContext, useState, useEffect, useRef } from "react";
import { trackAddToCart, trackInitiateCheckout } from "../lib/meta-pixel";
import { syncCartAction } from "../app/actions/cart";
import { flushAnalytics, track } from "../lib/analytics-client";

const StoreContext = createContext();

/** Items handed from the cart / "Buy now" to the /checkout page. */
export const CHECKOUT_STORAGE_KEY = "pubesto_checkout";

export const FREE_SHIPPING_THRESHOLD = 500;
export const STANDARD_SHIPPING_FEE = 70;
export const PREPAID_DISCOUNT_PERCENT = 10;

function findVariantForColor(product, colorName) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) return null;
  if (colorName) {
    const wanted = String(colorName).toLowerCase();
    const match = variants.find((variant) => String(variant.color || "").toLowerCase() === wanted);
    if (match) return match;
  }
  return variants.find((variant) => variant.id === product.variantId) || variants.find((variant) => variant.available) || variants[0];
}

/** What the server needs to price one cart line (it never trusts client prices). */
export function toCheckoutLine(item) {
  const product = item.product || item;
  const color = product.selectedColor || item.color || "";
  const variant = findVariantForColor(product, color);
  return {
    productId: product.id && !String(product.id).startsWith("gid://") ? product.id : product.slug,
    variantId: variant?.id && !String(variant.id).startsWith("gid://") ? variant.id : undefined,
    color,
    size: "",
    quantity: Math.max(1, Math.min(50, Math.floor(Number(item.quantity) || 1))),
  };
}

export function StoreProvider({ children, categories: initialCategories = [], products: initialProducts = [], heroSlides = [] }) {
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
  const [products, setProducts] = useState(initialProducts);
  const [categories, setCategories] = useState(initialCategories);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [wishlist, setWishlist] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("prepaid");
  const [footerPanel, setFooterPanel] = useState(null);
  const cartLoadedRef = useRef(false);

  // The server renders the catalog from the database; keep it in sync when it changes.
  useEffect(() => {
    if (initialProducts.length) setProducts(initialProducts);
  }, [initialProducts]);
  useEffect(() => {
    if (initialCategories.length) setCategories(initialCategories);
  }, [initialCategories]);

  useEffect(() => {
    if (cartLoadedRef.current) {
      try {
        localStorage.setItem("pubesto_cart", JSON.stringify(cartItems));
      } catch (err) {
        console.error("Error saving cart items to localStorage:", err);
      }
    }
  }, [cartItems]);

  useEffect(() => {
    refreshAuthSession();

    const savedWishlist = localStorage.getItem("pubesto_wishlist");
    if (savedWishlist) {
      try {
        setWishlist(JSON.parse(savedWishlist));
      } catch (e) {
        console.error("Error parsing wishlist", e);
      }
    }

    // Carts saved before the move off Shopify are re-matched to today's catalog
    // by slug, so prices, images and ids are always current.
    const savedCart = localStorage.getItem("pubesto_cart");
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);
        const catalog = initialProducts || [];
        const refreshed = (Array.isArray(parsed) ? parsed : [])
          .map((item) => {
            const live = catalog.find((p) => p.slug === item.product?.slug || p.id === item.product?.id);
            if (!catalog.length) return item;
            if (!live) return null;
            const selectedColor = item.product?.selectedColor;
            return { ...item, product: selectedColor ? { ...live, selectedColor } : live };
          })
          .filter(Boolean);
        setCartItems(refreshed);
      } catch (e) {
        console.error("Error parsing cart items:", e);
      }
    }
    localStorage.removeItem("shopify_cart");
    cartLoadedRef.current = true;
    // On remount (React strict mode), don't let the save effect write the
    // still-empty cart over what's stored before it is loaded again.
    return () => {
      cartLoadedRef.current = false;
    };
  }, []);

  // Mirror signed-in carts into the database (dashboard → Abandoned checkouts).
  useEffect(() => {
    if (!isLoggedIn || !cartLoadedRef.current) return undefined;
    const timer = setTimeout(() => {
      syncCartAction(cartItems.map(toCheckoutLine)).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [cartItems, isLoggedIn]);

  function getProductId(product) {
    const baseId = product.id || product.slug || product.name;
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

  function liveProductFor(product) {
    return products.find((p) => p.slug === product.slug || p.id === product.id) || product;
  }

  function getProductBasePrice(product) {
    const live = liveProductFor(product);
    const variant = product.selectedColor ? findVariantForColor(live, product.selectedColor) : null;
    if (variant && typeof variant.price === "number") return variant.price;
    if (typeof live.salePrice === "number") return live.salePrice;
    const rawPrice = String(live.price || "0").replace(/[^\d.]/g, "");
    return Number(rawPrice) || 0;
  }

  function getProductBaseOldPrice(product) {
    const live = liveProductFor(product);
    const variant = product.selectedColor ? findVariantForColor(live, product.selectedColor) : null;
    if (variant && typeof variant.compareAtPrice === "number") return variant.compareAtPrice;
    if (typeof live.originalPrice === "number") return live.originalPrice;
    const rawPrice = String(live.oldPrice || "0").replace(/[^\d.]/g, "");
    return Number(rawPrice) || 0;
  }

  function getCartItemTotalPrice(product, quantity) {
    return getProductBasePrice(product) * quantity;
  }

  function getCartItemTotalOldPrice(product, quantity) {
    const basePrice = getProductBasePrice(product);
    const baseOldPrice = getProductBaseOldPrice(product) || basePrice;
    return Math.max(baseOldPrice, basePrice) * quantity;
  }

  function getCartItemDisplayName(product) {
    const live = liveProductFor(product);
    const baseName = live.name || String(product.name || "").replace(/\s*\([^)]+\)/g, "").trim();
    return product.selectedColor ? `${baseName} - ${product.selectedColor}` : baseName;
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

  function openShopifyCart() {
    setIsCartOpen(true);
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
    trackAddToCart(product, addQuantity);
    track("ADD_TO_CART", { name: product.slug, payload: { productId: product.id, quantity: addQuantity, color: options.color || "" } });
    const selectedColor = options.color || product.selectedColor || "";
    const selectedColors = options.selectedColors || product.selectedColors || null;
    let cartProduct = selectedColor ? { ...product, selectedColor } : product;
    if (selectedColors && selectedColors.length > 0) {
      cartProduct = { ...cartProduct, selectedColors };
    }

    const nextCartItems = getNextCartItems(cartItems, cartProduct, addQuantity);
    setCartItems(nextCartItems);
    setCartPulseKey((key) => key + 1);
    setIsProfileOpen(false);
    setIsCartOpen(false);

    if (shouldOpenCart) {
      openShopifyCart(nextCartItems);
    }
  }

  /**
   * Sends the shopper to the checkout page. `items` is the cart by default, or
   * a single "Buy now" line. Prices are always recomputed on the server.
   */
  async function checkout(options = {}) {
    const activeItems = options.items || cartItems;
    const currentMethod = options.paymentMethod || paymentMethod;
    if (activeItems.length === 0) return;

    const itemsTotal = activeItems.reduce(
      (sum, item) => sum + getCartItemTotalPrice(item.product || item, item.quantity),
      0
    );
    const discount = currentMethod === "prepaid" ? Math.round((itemsTotal * PREPAID_DISCOUNT_PERCENT) / 100) : 0;
    const shipping = itemsTotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
    trackInitiateCheckout(activeItems, Math.max(0, itemsTotal - discount + shipping));
    track("BEGIN_CHECKOUT", { payload: { items: activeItems.length, value: itemsTotal } });

    try {
      sessionStorage.setItem(
        CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          source: options.items ? "buy_now" : "cart",
          paymentMethod: currentMethod,
          items: activeItems.map((item) => ({
            id: item.id || getProductId(item.product || item),
            product: item.product || item,
            quantity: item.quantity,
          })),
        })
      );
    } catch {
      /* storage unavailable: the checkout page falls back to the cart */
    }

    setIsCartOpen(false);
    flushAnalytics();
    window.location.href = "/checkout";
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
  const prepaidDiscountAmount = paymentMethod === "prepaid" ? Math.round((cartTotal * PREPAID_DISCOUNT_PERCENT) / 100) : 0;
  const cartShippingFee = cartTotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
  const cartFinalTotal = Math.max(0, cartTotal - prepaidDiscountAmount + cartShippingFee);

  const value = {
    isMenuOpen, setIsMenuOpen,
    isCartOpen, setIsCartOpen,
    isProfileOpen, setIsProfileOpen,
    isSearchOpen, setIsSearchOpen,
    cartItems, setCartItems,
    cartPulseKey, setCartPulseKey,
    paymentMethod, setPaymentMethod,
    prepaidDiscountAmount,
    prepaidDiscountPercent: PREPAID_DISCOUNT_PERCENT,
    cartShippingFee,
    cartFinalTotal,
    searchQuery, setSearchQuery,
    profileNotice, setProfileNotice,
    selectedCategory, setSelectedCategory,
    showAllProducts, setShowAllProducts,
    footerPanel, setFooterPanel,
    cartCount, cartTotal,
    shopifyCartUrl: "/cart", openShopifyCart,
    getProductId, getProductPrice,
    getCartItemTotalPrice, getCartItemTotalOldPrice, getCartItemDisplayName,
    closeUtilityPanels, addToCart, updateCartQuantity, removeFromCart, checkout,
    categories, products, heroSlides,
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
