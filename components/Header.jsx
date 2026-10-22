"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgePercent,
  Clock,
  Home,
  LayoutGrid,
  MapPin,
  Search,
  ShoppingCart,
  Sparkles,
  Truck,
  TrendingUp,
  User,
  X,
  Zap,
} from "lucide-react";
import { useStore } from "./StoreContext";
import AccountMenu from "./AccountMenu";
import { useHydrated } from "./useHydrated";
import { formatINR, getListableProducts, getSalePrice } from "../lib/utils";

const RECENT_KEY = "pubesto_recent_searches";
const POPULAR_TERMS = ["Neck fan", "Bottles", "Lunch box", "Speaker tumbler", "Mini AC", "Mist fan"];
const PLACEHOLDER_TERMS = ["\"neck fan\"", "\"lunch box\"", "\"water bottle\"", "\"mini cooler\"", "\"speaker tumbler\""];

const ANNOUNCEMENTS = [
  { icon: Zap, text: <>Extra <b>10% OFF</b> on all prepaid orders</> },
  { icon: Truck, text: <><b>FREE shipping</b> on orders above ₹500</> },
  { icon: Sparkles, text: <>Quality-checked products, <b>packed with care</b></> },
  { icon: BadgePercent, text: <>Easy <b>7-day returns</b> on eligible orders</> },
];

function readRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeRecent(list) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
}

// Typographic wordmark: heavy lowercase "pubesto" in sea blue, with the final "o"
// drawn as a turquoise ring and a small wave underline beneath "best".
export function Logo({ tone = "dark", tagline = false }) {
  return (
    <span className={`pb-logo ${tone === "light" ? "is-light" : ""}`}>
      <span className="pb-logo-word" aria-label="pubesto">
        <span aria-hidden="true">pub</span>
        <span className="pb-logo-best" aria-hidden="true">est</span>
        <span className="pb-logo-o" aria-hidden="true" />
      </span>
      {tagline ? <span className="pb-logo-tag">everyday essentials</span> : null}
    </span>
  );
}

export function useVisibleCategories() {
  const { categories, products } = useStore();
  return useMemo(() => {
    const listable = getListableProducts(products);
    return (categories || [])
      .map((category) => ({
        ...category,
        count: category.name === "Sale"
          ? listable.filter((p) => p.oldPrice || p.originalPrice).length
          : listable.filter((p) => (p.categories || []).some((c) => c.toLowerCase() === category.name.toLowerCase())).length,
      }))
      .filter((category) => category.count > 0);
  }, [categories, products]);
}

function SearchBar() {
  const { products } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recent, setRecent] = useState([]);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // Keep the box in sync with the search shown on /shop.
  useEffect(() => {
    setQuery(pathname === "/shop" ? searchParams.get("q") || "" : "");
  }, [pathname, searchParams]);

  useEffect(() => {
    const id = setInterval(() => setPlaceholderIndex((i) => (i + 1) % PLACEHOLDER_TERMS.length), 2600);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isFocused) return undefined;
    setRecent(readRecent());
    function handleClick(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setIsFocused(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isFocused]);

  const term = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (term.length < 2) return [];
    return getListableProducts(products)
      .filter((p) =>
        p.name.toLowerCase().includes(term) ||
        (p.categories || []).some((c) => c.toLowerCase().includes(term)) ||
        p.description?.toLowerCase().includes(term)
      )
      .slice(0, 6);
  }, [products, term]);

  useEffect(() => setActiveIndex(-1), [term]);

  function submit(value = query) {
    const trimmed = value.trim();
    if (!trimmed) return;
    const next = [trimmed, ...recent.filter((t) => t.toLowerCase() !== trimmed.toLowerCase())].slice(0, 6);
    setRecent(next);
    writeRecent(next);
    setQuery(trimmed);
    setIsFocused(false);
    inputRef.current?.blur();
    router.push(`/shop?q=${encodeURIComponent(trimmed)}`);
  }

  function openProduct(product) {
    setIsFocused(false);
    setQuery("");
    router.push(`/product/${product.slug}`);
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) openProduct(results[activeIndex]);
      else submit();
    } else if (event.key === "Escape") {
      setIsFocused(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div className="pb-search" ref={wrapRef}>
      <div className="pb-search-box">
        <Search size={19} />
        <div className="pb-search-field">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onKeyDown={handleKeyDown}
            aria-label="Search products"
            autoComplete="off"
          />
          {!query ? (
            <span className="pb-search-placeholder" aria-hidden="true">
              Search for
              <AnimatePresence mode="wait">
                <motion.em
                  key={placeholderIndex}
                  initial={{ y: 14, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -14, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {PLACEHOLDER_TERMS[placeholderIndex]}
                </motion.em>
              </AnimatePresence>
            </span>
          ) : null}
        </div>
        {query ? (
          <button className="pb-search-clear" type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} aria-label="Clear search">
            <X size={17} />
          </button>
        ) : null}
      </div>

      <AnimatePresence>
        {isFocused && (
          <motion.div
            className="pb-suggest"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.16 }}
          >
            {term.length >= 2 ? (
              results.length ? (
                <>
                  <div className="pb-suggest-label">Products</div>
                  {results.map((product, index) => (
                    <button
                      key={product.slug}
                      type="button"
                      className={`pb-suggest-item ${index === activeIndex ? "is-active" : ""}`}
                      style={{ width: "100%", border: 0, background: undefined, textAlign: "left" }}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => openProduct(product)}
                    >
                      <img src={product.image} alt="" />
                      <div>
                        <strong>{product.name}</strong>
                        <span><b>{formatINR(getSalePrice(product))}</b> · {product.categories?.[0] || "Essentials"}</span>
                      </div>
                    </button>
                  ))}
                  <button className="pb-btn pb-btn-outline pb-btn-block" style={{ marginTop: 10, height: 42 }} type="button" onClick={() => submit()}>
                    See all results for &ldquo;{query.trim()}&rdquo;
                  </button>
                </>
              ) : (
                <div className="pb-suggest-empty">
                  No matches for &ldquo;{query.trim()}&rdquo;. Try one of the popular searches below.
                  <div className="pb-chip-row" style={{ justifyContent: "center", marginTop: 12 }}>
                    {POPULAR_TERMS.slice(0, 4).map((t) => (
                      <button key={t} className="pb-chip" type="button" onClick={() => submit(t)}>{t}</button>
                    ))}
                  </div>
                </div>
              )
            ) : (
              <>
                {recent.length ? (
                  <>
                    <div className="pb-suggest-label">
                      Recent searches
                      <button type="button" onClick={() => { setRecent([]); writeRecent([]); }}>Clear</button>
                    </div>
                    <div className="pb-chip-row">
                      {recent.map((t) => (
                        <button key={t} className="pb-chip" type="button" onClick={() => submit(t)}>
                          <Clock size={13} /> {t}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
                <div className="pb-suggest-label">Trending on Pubesto</div>
                <div className="pb-chip-row" style={{ marginBottom: 0 }}>
                  {POPULAR_TERMS.map((t) => (
                    <button key={t} className="pb-chip" type="button" onClick={() => submit(t)}>
                      <TrendingUp size={13} /> {t}
                    </button>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CartButton() {
  const { cartCount, cartTotal, cartPulseKey, setIsCartOpen } = useStore();
  const isEmpty = cartCount === 0;

  return (
    <motion.button
      key={cartPulseKey}
      className={`pb-cart-btn ${isEmpty ? "is-empty" : ""}`}
      type="button"
      onClick={() => setIsCartOpen(true)}
      animate={cartPulseKey ? { scale: [1, 1.08, 1] } : undefined}
      transition={{ duration: 0.35 }}
      aria-label={`Open cart with ${cartCount} item${cartCount === 1 ? "" : "s"}`}
    >
      <ShoppingCart size={21} />
      <span className="pb-cart-btn-text">
        {isEmpty ? (
          "My Cart"
        ) : (
          <>
            {cartCount} item{cartCount === 1 ? "" : "s"}
            <small>{formatINR(cartTotal)}</small>
          </>
        )}
      </span>
    </motion.button>
  );
}

function TabBar() {
  const pathname = usePathname();
  const { cartCount, setIsCartOpen, isCartOpen, isLoggedIn } = useStore();

  return (
    <nav className="pb-tabbar pb-mobile-only" aria-label="Mobile navigation">
      <Link href="/" className={pathname === "/" && !isCartOpen ? "is-active" : ""} prefetch={false}>
        <Home size={21} />
        Home
      </Link>
      <Link href="/shop" className={pathname.startsWith("/shop") && !isCartOpen ? "is-active" : ""} prefetch={false}>
        <LayoutGrid size={21} />
        Categories
      </Link>
      <Link href={isLoggedIn ? "/account" : "/account/login"} className={pathname.startsWith("/account") && !isCartOpen ? "is-active" : ""} prefetch={false}>
        <User size={21} />
        Account
      </Link>
      <button type="button" className={isCartOpen ? "is-active" : ""} onClick={() => setIsCartOpen(true)}>
        <ShoppingCart size={21} />
        Cart
        {cartCount > 0 ? <span className="pb-tab-badge">{cartCount}</span> : null}
      </button>
    </nav>
  );
}

function CategoryNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hydrated = useHydrated();
  const visibleCategories = useVisibleCategories();
  const categories = hydrated ? visibleCategories : [];
  const activeCategory = pathname === "/shop" ? searchParams.get("category") : null;

  return (
    <nav className="pb-catnav pb-desktop-only" aria-label="Categories">
      <Link href="/shop" className={pathname === "/shop" && !activeCategory && !searchParams.get("q") ? "is-active" : ""} prefetch={false}>
        <LayoutGrid size={15} /> All products
      </Link>
      {categories.map((category) => (
        <Link
          key={category.name}
          href={`/shop?category=${encodeURIComponent(category.name)}`}
          className={`${activeCategory === category.name ? "is-active" : ""} ${category.name === "Sale" ? "is-sale" : ""}`}
          prefetch={false}
        >
          {category.name === "Sale" ? <BadgePercent size={15} /> : null}
          {category.label || category.name}
        </Link>
      ))}
      <span className="pb-catnav-spacer" />
      <Link href="/returns/track" prefetch={false}>
        <Truck size={15} /> Track order
      </Link>
      <Link href="/contact" prefetch={false}>Help</Link>
    </nav>
  );
}

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const { isLoggedIn } = useStore();

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div className="pb-announce" role="region" aria-label="Store offers">
        <div className="pb-announce-track">
          {[...ANNOUNCEMENTS, ...ANNOUNCEMENTS].map(({ icon: Icon, text }, index) => (
            <span key={index} aria-hidden={index >= ANNOUNCEMENTS.length}>
              <Icon size={14} /> {text}
            </span>
          ))}
        </div>
      </div>

      <header className={`pb-header ${isScrolled ? "is-scrolled" : ""}`}>
        <div className="pb-container">
          <div className="pb-header-row">
            <Link href="/" aria-label="Pubesto home" prefetch={false}>
              <Logo />
            </Link>

            <div className="pb-deliver pb-desktop-only">
              <strong>Delivery across India</strong>
              <small><MapPin size={12} /> Fast dispatch on most orders</small>
            </div>

            <div className="pb-desktop-only" style={{ flex: 1, minWidth: 0 }}>
              <SearchBar />
            </div>

            <div className="pb-header-actions pb-desktop-only">
              <AccountMenu />
              <CartButton />
            </div>

            <div className="pb-header-actions pb-mobile-only" style={{ marginLeft: "auto" }}>
              <Link className="pb-icon-btn" href={isLoggedIn ? "/account" : "/account/login"} aria-label="Account" prefetch={false} style={{ padding: "0 10px" }}>
                <User size={21} />
              </Link>
            </div>
          </div>

          <div className="pb-header-search-row pb-mobile-only" style={{ display: "block" }}>
            <SearchBar />
          </div>

          <CategoryNav />
        </div>
      </header>

      <TabBar />
    </>
  );
}
