"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, SearchX, X } from "lucide-react";
import { useStore } from "../../components/StoreContext";
import ProductCard from "../../components/ProductCard";
import { useHydrated } from "../../components/useHydrated";
import { useVisibleCategories } from "../../components/Header";
import { byBestSelling, byFeatured, byNewest, getDiscountPercent, getListableProducts, getSalePrice, hasTag, productInCategory } from "../../lib/utils";

// "newest" is the default so freshly uploaded products are seen first.
const DEFAULT_SORT = "newest";
const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "bestselling", label: "Best selling" },
  { value: "featured", label: "Featured" },
  { value: "discount", label: "Biggest discount" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Customer rating" },
];

const PRICE_RANGES = [
  { value: "all", label: "Any price", test: () => true },
  { value: "under-500", label: "Under ₹500", test: (p) => p < 500 },
  { value: "500-1000", label: "₹500 – ₹1,000", test: (p) => p >= 500 && p <= 1000 },
  { value: "over-1000", label: "Over ₹1,000", test: (p) => p > 1000 },
];

function matchesQuery(product, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    product.name.toLowerCase().includes(q) ||
    product.description?.toLowerCase().includes(q) ||
    (product.categories || []).some((c) => c.toLowerCase().includes(q))
  );
}

function ShopContent() {
  const { products } = useStore();
  const categories = useVisibleCategories();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeCategory = searchParams.get("category") || "";
  const query = (searchParams.get("q") || "").trim();
  const tag = (searchParams.get("tag") || "").trim();
  const sortParam = searchParams.get("sort");
  const sort = SORTS.some((s) => s.value === sortParam) ? sortParam : DEFAULT_SORT;
  const [priceRange, setPriceRange] = useState("all");

  function setParam(key, value) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const listable = useMemo(() => getListableProducts(products), [products]);

  const results = useMemo(() => {
    const range = PRICE_RANGES.find((r) => r.value === priceRange) || PRICE_RANGES[0];
    const filtered = listable.filter(
      (p) =>
        productInCategory(p, activeCategory) &&
        matchesQuery(p, query) &&
        (!tag || hasTag(p, [tag])) &&
        range.test(getSalePrice(p))
    );
    const sorters = {
      newest: byNewest,
      bestselling: byBestSelling,
      // Featured products in the merchant's order, then everything else newest first.
      featured: (a, b) => byFeatured(a, b) || byNewest(a, b),
      discount: (a, b) => getDiscountPercent(b) - getDiscountPercent(a),
      "price-asc": (a, b) => getSalePrice(a) - getSalePrice(b),
      "price-desc": (a, b) => getSalePrice(b) - getSalePrice(a),
      rating: (a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0),
    };
    // Out-of-stock items always sink to the end.
    return [...filtered].sort((a, b) => (a.inStock === false) - (b.inStock === false) || sorters[sort](a, b));
  }, [listable, activeCategory, query, tag, priceRange, sort]);

  const activeCategoryData = categories.find((c) => c.name === activeCategory);
  const title = query
    ? `Results for “${query}”`
    : activeCategoryData?.label || activeCategory || (tag ? `${tag} collection` : sort === "newest" && sortParam ? "New arrivals" : sort === "bestselling" && sortParam ? "Bestsellers" : "All products");

  return (
    <main className="pb-container">
      <div className="pb-page-head">
        <nav className="pb-crumbs" aria-label="Breadcrumb">
          <Link href="/" prefetch={false}>Home</Link>
          <span>/</span>
          {activeCategory || query ? <Link href="/shop" prefetch={false}>Shop</Link> : <span>Shop</span>}
          {activeCategory ? (<><span>/</span><span>{activeCategoryData?.label || activeCategory}</span></>) : null}
          {query ? (<><span>/</span><span>Search</span></>) : null}
        </nav>
        <h1>{title}</h1>
      </div>

      <div className="pb-shop">
        <aside className="pb-side pb-desktop-only" aria-label="Categories" style={{ display: "block" }}>
          <div className="pb-side-label">Categories</div>
          <button className={`pb-side-cat ${!activeCategory ? "is-active" : ""}`} type="button" onClick={() => setParam("category", "")}>
            <span className="pb-side-ico"><LayoutGrid size={18} /></span>
            All products
            <em>{listable.length}</em>
          </button>
          {categories.map((category) => (
            <button
              key={category.name}
              type="button"
              className={`pb-side-cat ${activeCategory === category.name ? "is-active" : ""}`}
              onClick={() => setParam("category", category.name)}
            >
              <img src={category.image} alt="" loading="lazy" />
              {category.label || category.name}
              <em>{category.count}</em>
            </button>
          ))}
        </aside>

        <section>
          <div className="pb-mcats pb-mobile-only">
            <button className={`pb-mcat ${!activeCategory ? "is-active" : ""}`} type="button" onClick={() => setParam("category", "")}>
              <span className="pb-side-ico"><LayoutGrid size={22} /></span>
              All
            </button>
            {categories.map((category) => (
              <button
                key={category.name}
                type="button"
                className={`pb-mcat ${activeCategory === category.name ? "is-active" : ""}`}
                onClick={() => setParam("category", category.name)}
              >
                <img src={category.image} alt="" loading="lazy" />
                {category.label || category.name}
              </button>
            ))}
          </div>

          <div className="pb-toolbar">
            <div className="pb-toolbar-left">
              {PRICE_RANGES.map((range) => (
                <button
                  key={range.value}
                  type="button"
                  className={`pb-chip ${priceRange === range.value ? "is-active" : ""}`}
                  onClick={() => setPriceRange(range.value)}
                >
                  {range.label}
                </button>
              ))}
              {query ? (
                <button type="button" className="pb-chip is-active" onClick={() => setParam("q", "")}>
                  “{query}” <X size={14} />
                </button>
              ) : null}
              {tag ? (
                <button type="button" className="pb-chip is-active" onClick={() => setParam("tag", "")}>
                  {tag} <X size={14} />
                </button>
              ) : null}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="pb-count pb-desktop-only"><b>{results.length}</b> item{results.length === 1 ? "" : "s"}</span>
              <label className="pb-sr-only" htmlFor="pb-sort">Sort by</label>
              <select id="pb-sort" className="pb-select" value={sort} onChange={(e) => setParam("sort", e.target.value === DEFAULT_SORT ? "" : e.target.value)}>
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>Sort: {s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {results.length ? (
            <div className="pb-grid">
              {results.map((product, index) => (
                <ProductCard key={product.slug} product={product} index={index} />
              ))}
            </div>
          ) : (
            <div className="pb-panel pb-empty">
              <div className="pb-empty-art"><SearchX size={44} strokeWidth={1.6} /></div>
              <h3>No products found</h3>
              <p>Try a different search or clear your filters.</p>
              <button
                className="pb-btn pb-btn-primary"
                type="button"
                onClick={() => {
                  setPriceRange("all");
                  router.push("/shop");
                }}
              >
                Clear all filters
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ShopSkeleton() {
  return (
    <main className="pb-container">
      <div className="pb-page-head">
        <div className="pb-skel" style={{ width: 140, height: 14, marginBottom: 14 }} />
        <div className="pb-skel" style={{ width: 260, height: 34 }} />
      </div>
      <div className="pb-shop">
        <div className="pb-skel pb-desktop-only" style={{ height: 420, borderRadius: 18 }} />
        <div className="pb-grid">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="pb-skel" style={{ aspectRatio: "3 / 4.4", borderRadius: 16 }} />
          ))}
        </div>
      </div>
    </main>
  );
}

function ShopGate() {
  // Catalogue data syncs from Shopify on the client; render after hydration so the
  // Suspense boundary never hydrates against a different product list.
  return useHydrated() ? <ShopContent /> : <ShopSkeleton />;
}

export default function ShopPage() {
  return (
    <Suspense fallback={<ShopSkeleton />}>
      <ShopGate />
    </Suspense>
  );
}
