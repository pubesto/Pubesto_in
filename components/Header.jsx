"use client";

import { useStore } from "./StoreContext";
import { SearchIcon, ShoppingBag, UserIcon, MenuIcon } from "./Icons";
import { useState, useEffect, useRef } from "react";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Home, ShoppingBag as LucideShoppingBag, User, ShoppingCart, ChevronRight, Eye, EyeOff, Package, Truck, LogOut, TrendingUp, X, Search } from "lucide-react";
import GoogleAuthButton from "./GoogleAuthButton";
import { formatPrice } from "../lib/utils";

export default function Header() {
  const {
    isMenuOpen, setIsMenuOpen,
    isCartOpen, setIsCartOpen,
    isProfileOpen,
    isSearchOpen, setIsSearchOpen,
    searchQuery, setSearchQuery,
    cartCount, cartPulseKey,
    closeUtilityPanels,
    setSelectedCategory, setShowAllProducts,
    products,
    isLoggedIn,
    user,
    logout,
    refreshAuthSession,
    cartItems,
    cartTotal,
    updateCartQuantity,
    removeFromCart,
    checkout,
    getCartItemTotalPrice,
    getCartItemDisplayName
  } = useStore();

  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [prevScroll, setPrevScroll] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const router = useRouter();
  const pathname = usePathname();
  const searchInputRef = useRef(null);

  const [isSearchHovered, setIsSearchHovered] = useState(false);
  const [isCartHovered, setIsCartHovered] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);

  useEffect(() => {
    if (isSearchOpen || isSearchHovered) {
      const saved = localStorage.getItem("pubesto_recent_searches");
      if (saved) {
        try {
          setRecentSearches(JSON.parse(saved));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [isSearchOpen, isSearchHovered]);

  const handleSearchSubmit = (term = searchQuery) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    
    setSearchQuery(trimmed);
    setIsSearchOpen(false);
    setIsSearchHovered(false);
    setShowAllProducts(true);

    // Save to recent searches
    const updated = [trimmed, ...recentSearches.filter(t => t.toLowerCase() !== trimmed.toLowerCase())].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem("pubesto_recent_searches", JSON.stringify(updated));

    if (window.location.pathname !== '/shop') {
      router.push('/shop');
    }
  };

  const handleClearHistory = (e) => {
    e.stopPropagation();
    setRecentSearches([]);
    localStorage.removeItem("pubesto_recent_searches");
  };

  // Filter products based on search query
  const filteredResults = searchQuery.trim().length >= 2
    ? products.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.categories?.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()))
      ).slice(0, 6)
    : [];

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    setActiveIndex(-1);
  }, [isSearchOpen]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [searchQuery]);

  const handleKeyDown = (e, isMobile = false) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, filteredResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0) {
        e.preventDefault();
        const product = filteredResults[activeIndex];
        router.push(`/product/${product.slug}`);
        setIsSearchOpen(false);
        setIsMenuOpen(false);
      } else {
        submitSearch(e);
      }
    } else if (e.key === "Escape") {
      setIsSearchOpen(false);
    }
  };

  useMotionValueEvent(scrollY, "change", (latest) => {
    if (isMenuOpen || isCartOpen || isProfileOpen || isSearchOpen) {
      setHidden(false);
      return;
    }

    if (latest > prevScroll && latest > 150) {
      setHidden(true);
    } else {
      setHidden(false);
    }
    setPrevScroll(latest);
  });

  function resetStoreView() {
    setSelectedCategory(null);
    setSearchQuery("");
    setShowAllProducts(false);
    setIsMenuOpen(false);
    setIsSearchOpen(false);
  }

  function openShopView() {
    setSelectedCategory(null);
    setSearchQuery("");
    setShowAllProducts(true);
    setIsMenuOpen(false);
    setIsSearchOpen(false);
  }

  function submitSearch(event) {
    event.preventDefault();
    setSelectedCategory(null);
    setShowAllProducts(true);
    setIsMenuOpen(false);
    setIsSearchOpen(false);
  }

  function clearSearch() {
    setSearchQuery("");
    setShowAllProducts(false);
  }

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "" });
  const [forgotEmail, setForgotEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authMessageKind, setAuthMessageKind] = useState("success");
  const [authLoading, setAuthLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const hoverTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      const container = document.querySelector(".profile-dropdown-container");
      if (container && !container.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  function handleMouseEnter() {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsDropdownOpen(true);
  }

  function handleMouseLeave() {
    hoverTimeoutRef.current = setTimeout(() => {
      // Do not close dropdown if any input or button inside the dropdown is focused
      const activeEl = document.activeElement;
      const isFocusedInside = activeEl && activeEl.closest(".profile-dropdown-popup");
      if (!isFocusedInside) {
        setIsDropdownOpen(false);
      }
    }, 350);
  }

  function handleDropdownBlur(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      handleMouseLeave();
    }
  }

  function startPopupGoogleAuth() {
    const redirect = `${window.location.pathname}${window.location.search || ""}`;
    window.location.href = `/api/auth/google?redirect=${encodeURIComponent(redirect)}`;
  }

  async function handlePopupAuth(event) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthMessage("");
    setAuthMessageKind("success");

    try {
      const formData = new FormData(event.currentTarget);
      const email = (formData.get("email") || "").toString().trim().toLowerCase();
      const password = (formData.get("password") || "").toString();
      const firstName = (formData.get("firstName") || "").toString().trim();
      const lastName = (formData.get("lastName") || "").toString().trim();
      const name = `${firstName} ${lastName}`.trim();
      const phone = (formData.get("phone") || "").toString().trim();

      const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const payload = authMode === "signup"
        ? {
            name,
            email,
            phone,
            password,
          }
        : {
            email,
            password,
          };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setAuthMessage(data.error || "Authentication failed.");
        setAuthMessageKind("error");
        return;
      }

      const nextUser = await refreshAuthSession?.();
      if (!nextUser && !data.user) {
        setAuthMessage("Account created, but session could not load.");
        setAuthMessageKind("error");
        setAuthMode("login");
        return;
      }

      setAuthMessage("Successfully signed in!");
      setAuthMessageKind("success");
      
      setTimeout(() => {
        setIsDropdownOpen(false);
        setAuthMessage("");
      }, 1000);
    } catch {
      setAuthMessage("Network error. Please try again.");
      setAuthMessageKind("error");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handlePopupForgot(event) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthMessage("");
    setAuthMessageKind("success");

    try {
      const formData = new FormData(event.currentTarget);
      const email = (formData.get("email") || "").toString().trim().toLowerCase();
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setAuthMessage(data.error || "Password reset failed.");
        setAuthMessageKind("error");
        return;
      }

      setAuthMessage(data.resetPath ? "Password reset link is ready for local testing." : (data.message || "Reset link prepared!"));
      setAuthMessageKind("success");
      setResetUrl(data.resetPath || data.resetUrl || "");
    } catch {
      setAuthMessage("Network error. Please try again.");
      setAuthMessageKind("error");
    } finally {
      setAuthLoading(false);
    }
  }

  function prepareAccountNavigation(e) {
    e?.preventDefault();
    setIsMenuOpen(false);
    setIsSearchOpen(false);
    closeUtilityPanels();
    router.push(isLoggedIn ? "/account" : "/account/login");
  }

  function prepareShopifyCartNavigation(e) {
    e?.preventDefault();
    setIsMenuOpen(false);
    setIsSearchOpen(false);
    setIsCartOpen(true);
  }

  return (
    <motion.header
      className="site-header"
      variants={{
        visible: { y: 0 },
        hidden: { y: "-100%" },
      }}
      animate={hidden ? "hidden" : "visible"}
      transition={{ duration: 0.35, ease: "easeInOut" }}
    >
      <div className="navbar-container">
        <nav className="navbar-links" aria-label="Primary navigation">
          <Link href="/" onClick={resetStoreView} prefetch={false}>
            Home
          </Link>
          <Link href="/shop" onClick={() => setIsMenuOpen(false)} prefetch={false}>
            Shop
          </Link>
        </nav>

        <Link href="/" className="brand navbar-brand" aria-label="Pubesto home" onClick={resetStoreView} prefetch={false}>
          Pubesto
        </Link>

        <div className="navbar-actions">
          <div 
            className="search-dropdown-container"
            onMouseEnter={() => {
              setIsMenuOpen(false);
              setIsSearchHovered(true);
            }}
            onMouseLeave={() => setIsSearchHovered(false)}
            style={{ position: 'relative' }}
          >
            <button
              className="navbar-icon"
              type="button"
              aria-label="Search products"
              aria-expanded={isSearchHovered || isSearchOpen}
              onClick={() => {
                setIsMenuOpen(false);
                setIsSearchOpen((open) => !open);
              }}
            >
              <SearchIcon />
            </button>
            
            {(isSearchHovered || isSearchOpen) && (
              <motion.div 
                className="search-dropdown-popup"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <div className="search-popup-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0, color: 'var(--ink)' }}>Search</h3>
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsSearchHovered(false);
                      setIsSearchOpen(false);
                    }} 
                    style={{ border: 'none', background: 'transparent', padding: '4px', fontSize: '16px', color: 'var(--muted)', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>

                <div className="search-popup-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="search-drawer-input-container">
                    <Search size={16} style={{ color: '#1b624b' }} />
                    <input
                      ref={searchInputRef}
                      type="search"
                      placeholder="Search products or collections..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSearchSubmit();
                        }
                      }}
                      autoFocus
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery("")} 
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 4px', fontSize: '12px', color: 'var(--muted)' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {searchQuery.trim().length >= 2 ? (
                    <div className="search-drawer-results" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                      {products.filter(p => 
                        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.categories?.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()))
                      ).slice(0, 4).map((product) => (
                        <Link
                          key={product.slug}
                          href={`/product/${product.slug}`}
                          className="search-result-card"
                          onClick={() => {
                            setIsSearchHovered(false);
                            setIsSearchOpen(false);
                            setSearchQuery("");
                          }}
                        >
                          <div className="search-result-image-wrapper">
                            <img src={product.image} alt={product.name} />
                          </div>
                          <div className="search-result-info">
                            <h4>{product.name}</h4>
                            <p>{product.price}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="search-drawer-section">
                        <h3 style={{ fontSize: '11px', fontWeight: '800', color: '#6f8588', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Recent searches</h3>
                        {recentSearches.length > 0 ? (
                          <div className="search-pills">
                            {recentSearches.map((term) => (
                              <button 
                                key={term} 
                                className="search-pill"
                                type="button"
                                onClick={() => handleSearchSubmit(term)}
                              >
                                {term}
                              </button>
                            ))}
                            <button 
                              className="search-clear-all" 
                              type="button"
                              onClick={handleClearHistory}
                            >
                              Clear all
                            </button>
                          </div>
                        ) : (
                          <p className="empty-text" style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>No recent searches yet.</p>
                        )}
                      </div>

                      <div className="search-drawer-section">
                        <h3 style={{ fontSize: '11px', fontWeight: '800', color: '#6f8588', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Popular right now</h3>
                        <div className="search-pills">
                          {["Neck Fan", "Bottles", "Lunch Box", "Speaker Tumbler", "Wall Mounted AC", "Copper Bottle", "LED Fan"].map((term) => (
                            <button 
                              key={term} 
                              className="search-pill"
                              type="button"
                              onClick={() => handleSearchSubmit(term)}
                            >
                              <TrendingUp size={12} style={{ color: '#1b624b' }} />
                              {term}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="search-popup-footer" style={{ display: 'flex', gap: '10px', marginTop: '8px', borderTop: '1px solid rgba(211, 201, 189, 0.4)', paddingTop: '12px' }}>
                  <button 
                    type="button"
                    onClick={() => handleSearchSubmit()}
                    style={{ 
                      flex: 2, 
                      height: '42px', 
                      background: '#1b624b', 
                      color: '#ffffff', 
                      border: 'none',
                      borderRadius: '9999px',
                      fontSize: '13.5px', 
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      fontFamily: 'var(--font-body, sans-serif)',
                      boxShadow: '0 4px 12px rgba(27, 98, 75, 0.15)'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#154d3b'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#1b624b'; }}
                  >
                    Search {searchQuery ? `"${searchQuery}"` : '""'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setIsSearchHovered(false);
                      setIsSearchOpen(false);
                    }}
                    style={{ 
                      flex: 1, 
                      height: '42px', 
                      background: '#ffffff', 
                      color: '#1b624b', 
                      border: '1px solid #1b624b',
                      borderRadius: '9999px',
                      fontSize: '13.5px', 
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      fontFamily: 'var(--font-body, sans-serif)'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(27, 98, 75, 0.04)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            )}
          </div>
          <div 
            className="profile-dropdown-container"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onFocus={handleMouseEnter}
            onBlur={handleDropdownBlur}
          >
            <button
              className="navbar-icon"
              type="button"
              aria-label="Open profile"
              aria-expanded={isDropdownOpen}
              onClick={prepareAccountNavigation}
            >
              <UserIcon />
            </button>
            
            {isDropdownOpen && (
              <div className="profile-dropdown-popup">
                {isLoggedIn && user ? (
                  <div className="dropdown-authed">
                    <div className="dropdown-welcome-wrapper">
                      <div className="dropdown-avatar">
                        {user.name ? user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "C"}
                      </div>
                      <div>
                        <p className="dropdown-welcome-label">Welcome,</p>
                        <p className="dropdown-welcome-name"><strong>{user.name || "Customer"}</strong></p>
                      </div>
                    </div>
                    <div className="dropdown-divider" />
                    <Link 
                      href="/account" 
                      className={`dropdown-item ${pathname === "/account" ? "active" : ""}`} 
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <User size={15} />
                      My Profile
                    </Link>
                    <Link 
                      href="/account?tab=orders#orders" 
                      className="dropdown-item" 
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <Package size={15} />
                      My Orders
                    </Link>
                    <Link 
                      href="/returns/track" 
                      className={`dropdown-item ${pathname === "/returns/track" ? "active" : ""}`} 
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <Truck size={15} />
                      Track Order
                    </Link>
                    <div className="dropdown-divider" />
                    <button 
                      className="dropdown-btn-logout" 
                      type="button" 
                      onClick={async () => {
                        await logout();
                        setIsDropdownOpen(false);
                        router.push("/");
                      }}
                    >
                      <LogOut size={14} />
                      Logout
                    </button>
                  </div>
                ) : (
                  <div className="dropdown-auth">
                    <div className="dropdown-tabs">
                      <button 
                        className={authMode === "login" ? "active" : ""} 
                        type="button" 
                        onClick={() => { setAuthMode("login"); setAuthMessage(""); setResetUrl(""); setShowPassword(false); }}
                      >
                        Login
                      </button>
                      <button 
                        className={authMode === "signup" ? "active" : ""} 
                        type="button" 
                        onClick={() => { setAuthMode("signup"); setAuthMessage(""); setResetUrl(""); setShowPassword(false); }}
                      >
                        Signup
                      </button>
                    </div>

                    {authMode === "forgot" ? (
                      <form onSubmit={handlePopupForgot} className="dropdown-form">
                        <label>
                          <span>Email address</span>
                          <input 
                            type="email" 
                            name="email"
                            autoComplete="email"
                            value={forgotEmail} 
                            onChange={(e) => setForgotEmail(e.target.value)} 
                            placeholder="you@example.com" 
                            required 
                          />
                        </label>
                        {authMessage && (
                          <p className={`dropdown-message ${authMessageKind === "error" ? "error" : ""}`}>
                            {authMessage}
                          </p>
                        )}
                        {resetUrl && (
                          resetUrl.startsWith("/") ? (
                            <Link 
                              className="dropdown-reset-link" 
                              href={resetUrl} 
                              onClick={() => {
                                setIsDropdownOpen(false);
                                setResetUrl("");
                              }}
                            >
                              Continue to reset password
                            </Link>
                          ) : (
                            <a 
                              className="dropdown-reset-link" 
                              href={resetUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              onClick={() => {
                                setIsDropdownOpen(false);
                                setResetUrl("");
                              }}
                            >
                              Continue to reset password
                            </a>
                          )
                        )}
                        <button type="submit" className="dropdown-submit" disabled={authLoading}>
                          {authLoading ? "Sending..." : "Reset Password"}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handlePopupAuth} className="dropdown-form">
                        <GoogleAuthButton className="google-auth-button--dropdown" onClick={startPopupGoogleAuth} disabled={authLoading} />
                        <div className="dropdown-oauth-divider"><span>or</span></div>
                        {authMode === "signup" && (
                          <>
                            <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                              <label style={{ flex: 1, minWidth: 0 }}>
                                <span>First Name</span>
                                <input 
                                  type="text" 
                                  name="firstName"
                                  autoComplete="given-name"
                                  value={signupForm.firstName || ""} 
                                  onChange={(e) => setSignupForm(prev => ({ ...prev, firstName: e.target.value }))} 
                                  placeholder="First name" 
                                  required 
                                />
                              </label>
                              <label style={{ flex: 1, minWidth: 0 }}>
                                <span>Last Name</span>
                                <input 
                                  type="text" 
                                  name="lastName"
                                  autoComplete="family-name"
                                  value={signupForm.lastName || ""} 
                                  onChange={(e) => setSignupForm(prev => ({ ...prev, lastName: e.target.value }))} 
                                  placeholder="Last name" 
                                  required 
                                />
                              </label>
                            </div>
                            <label>
                              <span>Phone</span>
                              <input 
                                type="tel" 
                                name="phone"
                                autoComplete="tel"
                                value={signupForm.phone} 
                                onChange={(e) => setSignupForm(prev => ({ ...prev, phone: e.target.value }))} 
                                placeholder="Optional" 
                              />
                            </label>
                          </>
                        )}
                        <label>
                          <span>Email address</span>
                          <input 
                            type="email" 
                            name="email"
                            autoComplete="email"
                            value={authMode === "signup" ? signupForm.email : loginForm.email} 
                            onChange={(e) => authMode === "signup" 
                              ? setSignupForm(prev => ({ ...prev, email: e.target.value }))
                              : setLoginForm(prev => ({ ...prev, email: e.target.value }))
                            } 
                            placeholder="you@example.com" 
                            required 
                          />
                        </label>
                        <label>
                          <span>Password</span>
                          <div className="dropdown-password-wrap">
                            <input 
                              type={showPassword ? "text" : "password"} 
                              name="password"
                              autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                              value={authMode === "signup" ? signupForm.password : loginForm.password} 
                              onChange={(e) => authMode === "signup" 
                                ? setSignupForm(prev => ({ ...prev, password: e.target.value }))
                                : setLoginForm(prev => ({ ...prev, password: e.target.value }))
                              } 
                              placeholder="At least 8 chars" 
                              required 
                              minLength={8}
                            />
                            <button
                              type="button"
                              className="dropdown-password-toggle"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </label>
                        {authMessage && (
                          <p className={`dropdown-message ${authMessageKind === "error" ? "error" : ""}`}>
                            {authMessage}
                          </p>
                        )}
                        <button type="submit" className="dropdown-submit" disabled={authLoading}>
                          {authLoading ? "Please wait..." : authMode === "signup" ? "Create Account" : "Login"}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div 
            className="cart-dropdown-container"
            onMouseEnter={() => {
              setIsMenuOpen(false);
              setIsCartHovered(true);
            }}
            onMouseLeave={() => setIsCartHovered(false)}
            style={{ position: 'relative' }}
          >
            <button
              className="navbar-icon navbar-cart cart-action"
              type="button"
              aria-label={`Open cart with ${cartCount} item${cartCount === 1 ? "" : "s"}`}
              onClick={() => {
                setIsMenuOpen(false);
                setIsCartOpen((open) => !open);
              }}
            >
              <motion.div
                key={cartPulseKey}
                className="cart-icon-wrapper"
                animate={
                  cartPulseKey
                    ? { scale: [1, 1.18, 1], rotate: [0, -5, 4, 0] }
                    : { scale: 1, rotate: 0 }
                }
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                <ShoppingBag />
                <span className="cart-count">{cartCount}</span>
              </motion.div>
            </button>
            
            {(isCartHovered || isCartOpen) && (
              <motion.div 
                className="cart-dropdown-popup"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid rgba(211, 201, 189, 0.4)', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                    Your Cart {cartCount > 0 && <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted)', marginLeft: '4px' }}>({cartCount})</span>}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCartHovered(false);
                      setIsCartOpen(false);
                    }}
                    style={{ border: 'none', background: 'transparent', padding: '4px', fontSize: '16px', color: 'var(--muted)', cursor: 'pointer', lineHeight: 1 }}
                  >
                    ✕
                  </button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', maxHeight: '320px', paddingRight: '4px' }}>
                  {cartItems.length > 0 ? (
                    <>
                      {/* Free Shipping Progress Bar */}
                      {(() => {
                        const threshold = 500;
                        const percent = Math.min(100, (cartTotal / threshold) * 100);
                        const needed = threshold - cartTotal;
                        return (
                          <div style={{ background: 'var(--cream, #f8f6f2)', border: '1px solid rgba(211, 201, 189, 0.5)', borderRadius: '10px', padding: '10px 12px', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>
                              <span style={{ fontSize: '14px' }}>{percent >= 100 ? '🎉' : '🚚'}</span>
                              <span>
                                {percent >= 100 ? (
                                  <strong style={{ color: 'var(--brand-color)' }}>Free Shipping unlocked!</strong>
                                ) : (
                                  <span>Add <strong>{formatPrice(needed)}</strong> more for <strong>Free Shipping</strong></span>
                                )}
                              </span>
                            </div>
                            <div style={{ width: '100%', height: '5px', background: 'rgba(211, 201, 189, 0.3)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${percent}%`, height: '100%', background: 'var(--brand-color)', transition: 'width 0.3s ease', borderRadius: '3px' }} />
                            </div>
                          </div>
                        );
                      })()}

                      {/* Items List */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {cartItems.map((item) => (
                          <article
                            key={item.id}
                            style={{ display: 'grid', gridTemplateColumns: '54px 1fr auto', gap: '10px', alignItems: 'start', border: '1px solid rgba(211, 201, 189, 0.3)', borderRadius: '8px', padding: '10px', background: 'rgba(211, 201, 189, 0.05)' }}
                          >
                            <Link
                              href={`/product/${item.product.slug}`}
                              onClick={() => {
                                setIsCartHovered(false);
                                setIsCartOpen(false);
                              }}
                              style={{ display: 'block', width: '54px', height: '54px', overflow: 'hidden', borderRadius: '4px', flexShrink: 0 }}
                            >
                              <img
                                src={item.product.image}
                                alt={item.product.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            </Link>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                              <Link
                                href={`/product/${item.product.slug}`}
                                onClick={() => {
                                  setIsCartHovered(false);
                                  setIsCartOpen(false);
                                }}
                                style={{ textDecoration: 'none', color: 'inherit' }}
                              >
                                <h4 style={{ fontSize: '12px', fontWeight: 700, margin: 0, color: 'var(--ink)', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {getCartItemDisplayName(item.product, item.quantity)}
                                </h4>
                              </Link>
                              <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--brand-color)', margin: 0 }}>
                                {formatPrice(getCartItemTotalPrice(item.product, item.quantity) / item.quantity)}
                              </p>
                              
                              {/* Quantity Controls */}
                              <div style={{ display: 'inline-grid', gridTemplateColumns: '20px 24px 20px', alignItems: 'center', border: '1px solid rgba(211, 201, 189, 0.6)', borderRadius: '4px', background: '#fff', width: 'fit-content', marginTop: '2px', overflow: 'hidden' }}>
                                <button
                                  type="button"
                                  onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                                  style={{ border: 'none', background: 'transparent', width: '20px', height: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  −
                                </button>
                                <span style={{ textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--ink)', borderLeft: '1px solid rgba(211,201,189,0.4)', borderRight: '1px solid rgba(211,201,189,0.4)', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                                  style={{ border: 'none', background: 'transparent', width: '20px', height: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                              <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--ink)' }}>
                                {formatPrice(getCartItemTotalPrice(item.product, item.quantity))}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeFromCart(item.id)}
                                style={{ border: '1px solid rgba(211,201,189,0.5)', background: 'transparent', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '9px', padding: 0 }}
                              >
                                ✕
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    </>
                  ) : (
                    /* Empty State (Matching the User's Screenshot Exactly) */
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      {/* Upper centered content */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 10px 12px 10px', textAlign: 'center' }}>
                        {/* Elegant circle with bag icon */}
                        <div style={{ 
                          width: '100px', 
                          height: '100px', 
                          borderRadius: '50%', 
                          border: '1px solid #f0e9df', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          marginBottom: '20px', 
                          background: '#faf8f6' 
                        }}>
                          <ShoppingBag size={38} strokeWidth={1.2} style={{ color: 'var(--muted)' }} />
                        </div>
                        
                        {/* Title */}
                        <h3 style={{ 
                          fontSize: '22px', 
                          fontWeight: 700, 
                          color: '#2a3d40', 
                          margin: '0 0 8px 0',
                          fontFamily: 'var(--font-body, sans-serif)',
                          letterSpacing: '-0.02em'
                        }}>
                          Your cart is empty
                        </h3>
                        
                        {/* Subtitle */}
                        <p style={{ 
                          fontSize: '14.5px', 
                          color: 'var(--muted)', 
                          margin: '0 0 24px 0', 
                          fontFamily: 'var(--font-body, sans-serif)',
                          lineHeight: 1.4
                        }}>
                          Let's add something you'll love.
                        </p>
                        
                        {/* Inner Continue Shopping Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsCartHovered(false);
                            setIsCartOpen(false);
                            router.push('/shop');
                          }}
                          style={{ 
                            background: '#1b624b', 
                            color: '#ffffff', 
                            border: 'none',
                            borderRadius: '9999px',
                            padding: '12px 32px', 
                            fontSize: '15px', 
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                            fontFamily: 'var(--font-body, sans-serif)',
                            boxShadow: '0 4px 12px rgba(27, 98, 75, 0.15)'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#154d3b'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#1b624b'; }}
                        >
                          Continue shopping
                        </button>
                      </div>

                      {/* Separator line */}
                      <hr style={{ border: 'none', borderTop: '1px solid #f0e9df', margin: '8px 0 16px 0' }} />

                      {/* Subtotal section */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--muted)', fontFamily: 'var(--font-body, sans-serif)' }}>Subtotal</span>
                        <span style={{ fontSize: '17px', fontWeight: 700, color: '#2a3d40', fontFamily: 'var(--font-body, sans-serif)' }}>Rs. 0</span>
                      </div>

                      {/* Taxes calculated at checkout */}
                      <p style={{ 
                        fontSize: '12px', 
                        color: 'var(--muted)', 
                        margin: '0 0 20px 0', 
                        textAlign: 'center',
                        fontFamily: 'var(--font-body, sans-serif)'
                      }}>
                        Taxes calculated at checkout.
                      </p>

                      {/* Bottom action buttons */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <button
                          type="button"
                          disabled
                          style={{ 
                            width: '100%', 
                            height: '50px', 
                            background: '#c3d2cc', 
                            color: '#ffffff', 
                            border: 'none',
                            borderRadius: '9999px',
                            fontSize: '15px', 
                            fontWeight: 700,
                            cursor: 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: 'var(--font-body, sans-serif)'
                          }}
                        >
                          Cart is empty
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            setIsCartHovered(false);
                            setIsCartOpen(false);
                            router.push('/shop');
                          }}
                          style={{ 
                            width: '100%', 
                            height: '50px', 
                            background: '#ffffff', 
                            color: '#1b624b', 
                            border: '1px solid #1b624b',
                            borderRadius: '9999px',
                            fontSize: '15px', 
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                            fontFamily: 'var(--font-body, sans-serif)'
                          }}
                          onMouseEnter={(e) => { 
                            e.currentTarget.style.background = 'rgba(27, 98, 75, 0.04)'; 
                          }}
                          onMouseLeave={(e) => { 
                            e.currentTarget.style.background = '#ffffff'; 
                          }}
                        >
                          Continue shopping
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer for active cart items */}
                {cartItems.length > 0 && (
                  <div style={{ borderTop: '1px solid rgba(211, 201, 189, 0.4)', paddingTop: '12px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>Subtotal</span>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)' }}>{formatPrice(cartTotal)}</span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>Shipping</span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: cartTotal >= 500 ? 'var(--brand-color)' : 'var(--ink)' }}>
                        {cartTotal >= 500 ? 'FREE' : formatPrice(70)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px', borderTop: '1px dashed rgba(211, 201, 189, 0.3)', paddingTop: '6px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)' }}>Total</span>
                      <strong style={{ fontSize: '17px', fontWeight: 800, color: 'var(--brand-color)' }}>
                        {formatPrice(cartTotal + (cartTotal >= 500 ? 0 : 70))}
                      </strong>
                    </div>

                    <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '2px 0 4px', textAlign: 'center' }}>Taxes calculated at checkout.</p>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCartHovered(false);
                          setIsCartOpen(false);
                          if (!isLoggedIn) {
                            setAuthMode("signup");
                            setIsDropdownOpen(true);
                          } else {
                            checkout();
                          }
                        }}
                        style={{ 
                          flex: 2, 
                          height: '46px', 
                          background: '#1b624b', 
                          color: '#ffffff', 
                          border: 'none',
                          borderRadius: '9999px',
                          fontSize: '14px', 
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease',
                          fontFamily: 'var(--font-body, sans-serif)',
                          boxShadow: '0 4px 12px rgba(27, 98, 75, 0.15)'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#154d3b'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#1b624b'; }}
                      >
                        Checkout
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCartHovered(false);
                          setIsCartOpen(false);
                          router.push('/shop');
                        }}
                        style={{ 
                          flex: 1, 
                          height: '46px', 
                          background: '#ffffff', 
                          color: '#1b624b', 
                          border: '1px solid #1b624b',
                          borderRadius: '9999px',
                          fontSize: '14px', 
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease',
                          fontFamily: 'var(--font-body, sans-serif)'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(27, 98, 75, 0.04)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                      >
                        Shop
                      </button>
                    </div>
                  </div>
                
                )}
              </motion.div>
            )}
          </div>
        </div>

        <button
          className="mobile-menu-toggle"
          type="button"
          onClick={() => {
            setIsSearchOpen(false);
            setIsMenuOpen((open) => !open);
          }}
          aria-label="Toggle menu"
          aria-expanded={isMenuOpen}
        >
          <MenuIcon open={isMenuOpen} />
        </button>
      </div>

      {/* Search drawer is now rendered globally by Drawers.jsx */}

      <div className={`mobile-nav-content ${isMenuOpen ? "open" : ""}`}>
        <div className="mobile-nav-header">
          <span className="mobile-nav-logo">Pubesto</span>
        </div>
        
        <div className="mobile-nav-links">
          <Link href="/" className="mobile-nav-item" onClick={() => { resetStoreView(); setIsMenuOpen(false); }}>
            <span className="mobile-nav-item-content">
              <Home size={20} />
              <span>Home</span>
            </span>
            <ChevronRight size={18} className="chevron-icon" />
          </Link>

          <Link href="/shop" className="mobile-nav-item" onClick={() => setIsMenuOpen(false)}>
            <span className="mobile-nav-item-content">
              <LucideShoppingBag size={20} />
              <span>Shop</span>
            </span>
            <ChevronRight size={18} className="chevron-icon" />
          </Link>

          <button className="mobile-nav-item" type="button" onClick={() => { setIsMenuOpen(false); prepareAccountNavigation(); }}>
            <span className="mobile-nav-item-content">
              <User size={20} />
              <span>Profile</span>
            </span>
            <ChevronRight size={18} className="chevron-icon" />
          </button>

          <button className="mobile-nav-item" type="button" onClick={() => { setIsMenuOpen(false); prepareShopifyCartNavigation(); }}>
            <span className="mobile-nav-item-content">
              <ShoppingCart size={20} />
              <span>Cart</span>
            </span>
            <span className="mobile-nav-item-right">
              {cartCount > 0 && <span className="mobile-cart-badge">{cartCount}</span>}
              <ChevronRight size={18} className="chevron-icon" />
            </span>
          </button>
        </div>

        <div className="mobile-nav-footer">
          <p className="mobile-nav-footer-title">Need help?</p>
          <a href="mailto:support@pubesto.com" className="mobile-nav-footer-link">support@pubesto.com</a>
          <p className="mobile-nav-footer-hours">Mon - Sat: 10AM - 7PM</p>
        </div>
      </div>
    </motion.header>
  );
}
