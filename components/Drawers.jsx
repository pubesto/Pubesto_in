"use client";

import Link from "next/link";

import { useStore } from "./StoreContext";
import { UserIcon, SearchIcon } from "./Icons";
import { formatPrice } from "../lib/utils";
import { motion } from "framer-motion";
import { ChevronRight, LogIn, LogOut, MapPin, Package, TrendingUp, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GoogleAuthButton from "./GoogleAuthButton";


export default function Drawers() {
  const {
    isCartOpen, setIsCartOpen,
    isProfileOpen, setIsProfileOpen,
    cartItems, cartCount, cartTotal,
    updateCartQuantity, removeFromCart, checkout,
    profileNotice,
    user, isLoggedIn, logout,
    getCartItemTotalPrice, getCartItemDisplayName,
    isSearchOpen, setIsSearchOpen,
    searchQuery, setSearchQuery,
    products,
    setShowAllProducts
  } = useStore();
  const router = useRouter();

  const [recentSearches, setRecentSearches] = useState([]);

  useEffect(() => {
    if (isSearchOpen) {
      const saved = localStorage.getItem("pubesto_recent_searches");
      if (saved) {
        try {
          setRecentSearches(JSON.parse(saved));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [isSearchOpen]);

  const handleSearchSubmit = (term = searchQuery) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    
    setSearchQuery(trimmed);
    setIsSearchOpen(false);
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

  const handleDrawerLogout = async () => {
    await logout();
    setIsProfileOpen(false);
  };

  const handleDrawerGoogleAuth = () => {
    setIsProfileOpen(false);
    window.location.href = "/api/auth/google?redirect=/account";
  };




  return (
    <>

      {isProfileOpen && (
        <div className="cart-layer">
          <motion.button
            className="cart-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsProfileOpen(false)}
          />
          <motion.aside 
            className="cart-drawer utility-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
          >
            <div className="cart-drawer-header premium-gradient">
              <div>
                <p className="eyebrow" style={{ color: 'rgba(255,255,255,0.7)' }}>Your account</p>
                <h2 style={{ color: '#fff' }}>Pubesto Account</h2>
              </div>
              <button 
                type="button" 
                onClick={() => setIsProfileOpen(false)} 
                style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
              >
                Close
              </button>
            </div>

            <div className="utility-panel-body">
              <motion.div
                key={isLoggedIn ? "customer-account" : "guest-account"}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="shopify-account-panel"
              >
                {isLoggedIn && user ? (
                  <>
                    <div className="profile-summary premium-card">
                      <div className="avatar-glow">
                        <UserIcon />
                      </div>
                      <div>
                        <strong>{user.name || "Pubesto Customer"}</strong>
                        <p>{user.email}</p>
                      </div>
                    </div>

                    <div className="shopify-account-actions">
                      <Link
                        className="action-button shopify-account-primary"
                        href="/account"
                        onClick={() => setIsProfileOpen(false)}
                      >
                        <span>Manage account</span>
                        <ChevronRight size={16} />
                      </Link>
                      <button className="shopify-account-secondary" type="button" onClick={handleDrawerLogout}>
                        <LogOut size={16} />
                        <span>Log out</span>
                      </button>
                    </div>

                    <div className="utility-link-list interactive-list shopify-account-links">
                      <Link href="/account" onClick={() => setIsProfileOpen(false)}>
                        <div className="link-icon"><Package size={18} /></div>
                        <span>Profile details</span>
                        <ChevronRight size={16} className="chevron" />
                      </Link>
                      <Link href="/account#addresses" onClick={() => setIsProfileOpen(false)}>
                        <div className="link-icon"><MapPin size={18} /></div>
                        <span>Saved addresses</span>
                        <ChevronRight size={16} className="chevron" />
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="profile-summary premium-card">
                      <div className="avatar-glow">
                        <UserIcon />
                      </div>
                      <div>
                        <strong>Your Pubesto account</strong>
                        <p>Log in or create an account to manage your profile and saved addresses.</p>
                      </div>
                    </div>

                    <div className="shopify-account-actions">
                      <Link
                        className="action-button shopify-account-primary"
                        href="/account/login"
                        onClick={() => setIsProfileOpen(false)}
                      >
                        <span>Log in</span>
                        <ChevronRight size={16} />
                      </Link>
                      <Link
                        className="shopify-account-secondary"
                        href="/account/login?mode=signup"
                        onClick={() => setIsProfileOpen(false)}
                      >
                        <LogIn size={16} />
                        <span>Create account</span>
                      </Link>
                      <GoogleAuthButton className="google-auth-button--drawer" onClick={handleDrawerGoogleAuth} />
                    </div>
                  </>
                )}
              </motion.div>
              
              {profileNotice && (
                <motion.p 
                  key={profileNotice}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="utility-notice success"
                >
                  {profileNotice}
                </motion.p>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </>
  );
}
