"use client";

import "../shop.css";
import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, Filter, X as CloseIcon, ShoppingBag, Search, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useStore } from "../../components/StoreContext";

function getShopProductKey(product) {
  return product.sku || product.slug || product.name;
}

function ProductCard({ product, addToCart, cartItems, getProductId, updateCartQuantity }) {
  const parsePrice = (priceStr) => {
    const num = Number((priceStr || '').replace(/[^\d.]/g, ''));
    return isNaN(num) || num === 0 ? null : num;
  };
  const sale = product.salePrice || parsePrice(product.price);
  const original = product.originalPrice || parsePrice(product.oldPrice);
  const dynBadge = (sale && original && original > sale) 
    ? `${Math.round(((original - sale) / original) * 100)}% OFF` 
    : product.badge;

  const cartQuantity = cartItems.find((item) => item.id === getProductId(product))?.quantity || 0;

  return (
    <article className="premium-product-card rail-card">
      <div className={`card-visual ${product.inStock === false ? 'is-out-of-stock' : ''}`}>
        {product.inStock === false ? (
          <span className="card-badge badge-out-of-stock">Out of Stock</span>
        ) : dynBadge ? (
          <span className="card-badge">{dynBadge}</span>
        ) : null}

        <Link href={`/product/${product.slug}`} className="image-wrapper">
          <img src={product.image} alt={product.name} loading="lazy" decoding="async" />
          <div className="image-overlay" />
        </Link>
        {product.inStock !== false && (
          <button className="quick-add-circle" onClick={() => addToCart(product)}>
            <ShoppingBag size={20} />
          </button>
        )}
      </div>

      <div className="card-body">
        <div className="card-meta">
          <span className="card-category">{product.categories?.[0] || 'Essential'}</span>
          <div className="card-rating">
            <Star size={12} fill="currentColor" />
            <span>{product.rating || '4.8'}</span>
          </div>
        </div>
        <Link href={`/product/${product.slug}`}>
          <h3 className="card-name">{product.name}</h3>
        </Link>
        <div className="card-price-area">
          <span className="current-price">{product.price}</span>
          {product.oldPrice && <span className="old-price">{product.oldPrice}</span>}
        </div>
        
        {product.inStock === false ? (
          <button className="card-action-btn disabled" disabled>
            Out of Stock
          </button>
        ) : cartQuantity > 0 ? (
          <div className="card-cart-manager">
            <button onClick={() => updateCartQuantity(getProductId(product), cartQuantity - 1)}>
              <Minus size={14} />
            </button>
            <span>{cartQuantity}</span>
            <button onClick={() => updateCartQuantity(getProductId(product), cartQuantity + 1)}>
              <Plus size={14} />
            </button>
          </div>
        ) : (
          <button className="card-action-btn" onClick={() => addToCart(product)}>
            Add to Cart
          </button>
        )}
      </div>
    </article>
  );
}

function ProductRail({ title, subtitle, products, addToCart, cartItems, getProductId, updateCartQuantity }) {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -380 : 380;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (!products || products.length === 0) return null;

  return (
    <section className="product-rail-section">
      <div className="rail-header">
        <div className="rail-title-wrap">
          <h2>{title}</h2>
          {subtitle && <p className="rail-subtitle">{subtitle}</p>}
        </div>
        <div className="rail-controls">
          <button className="rail-arrow left" onClick={() => scroll('left')} aria-label="Scroll left">
            <ChevronLeft size={20} />
          </button>
          <button className="rail-arrow right" onClick={() => scroll('right')} aria-label="Scroll right">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="rail-track" ref={scrollRef}>
        {products.map((product) => (
          <ProductCard
            key={getShopProductKey(product)}
            product={product}
            addToCart={addToCart}
            cartItems={cartItems}
            getProductId={getProductId}
            updateCartQuantity={updateCartQuantity}
          />
        ))}
      </div>
    </section>
  );
}

function ShopContent() {
  const { 
    addToCart, updateCartQuantity, cartItems, getProductId,
    searchQuery, products
  } = useStore();
  
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [priceRange, setPriceRange] = useState("all");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Derive dynamic categories from products
  const dynamicCategories = useMemo(() => {
    const allCats = products.flatMap(p => p.categories || []);
    const uniqueCats = Array.from(new Set(allCats))
      .filter(cat => cat.toLowerCase() !== 'home page')
      .sort();
    return uniqueCats;
  }, [products]);

  const handleAddToCart = (product) => {
    addToCart(product);
  };

  // Group products by category
  const categoryGroupedProducts = useMemo(() => {
    const baseProducts = products.filter((p) => p.image);

    const filterFn = (product) => {
      const numericPrice = Number(product.price?.replace(/[^\d]/g, "")) || product.salePrice || 0;
      let priceMatch = true;
      if (priceRange === "under-500") priceMatch = numericPrice < 500;
      else if (priceRange === "500-1000") priceMatch = numericPrice >= 500 && numericPrice <= 1000;
      else if (priceRange === "over-1000") priceMatch = numericPrice > 1000;

      const searchMatch = !searchQuery || 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.categories || []).some(cat => cat.toLowerCase().includes(searchQuery.toLowerCase()));

      return priceMatch && searchMatch;
    };

    const validProducts = baseProducts.filter(filterFn);

    const allProducts = validProducts;

    const categoriesMap = {};
    dynamicCategories.forEach(cat => {
      if (selectedCategories.length === 0 || selectedCategories.includes(cat)) {
        const catProducts = validProducts.filter(p => (p.categories || []).includes(cat));
        if (catProducts.length > 0) {
          categoriesMap[cat] = catProducts;
        }
      }
    });

    return { allProducts, categoriesMap };
  }, [selectedCategories, priceRange, searchQuery, products, dynamicCategories]);

  const toggleCategory = (cat) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((f) => f !== cat) : [...prev, cat]
    );
  };

  const hasAnyRail = categoryGroupedProducts.allProducts.length > 0 || Object.keys(categoryGroupedProducts.categoriesMap).length > 0;

  return (
    <main className="pubesto-shop-v2">
      {/* Premium Hero Header */}
      <header className="shop-hero-section">
        <div className="hero-blur-bg" />
        <motion.div 
          className="shop-hero-content"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
        >
          <span className="hero-subtitle">Curated Collections</span>
          <h1 className="hero-title">The Art of <span>Everyday Living.</span></h1>
          <p className="hero-desc">
            Explore our artisanal collections rail by rail. Scroll left and right to discover premium essentials tailored for your home.
          </p>
        </motion.div>
      </header>

      <div className="shop-main-layout">
        {/* Mobile Toggle & Active Filters Bar */}
        <div className="shop-controls-mobile">
          <button 
            className="filter-toggle-btn" 
            onClick={() => setIsSidebarOpen(true)}
          >
            <Filter size={18} />
            <span>Filter Categories</span>
          </button>
        </div>

        <div className="shop-flex-container">
          {/* Advanced Sidebar */}
          <aside className={`shop-sidebar-v2 ${isSidebarOpen ? 'is-open' : ''}`}>
            <div className="sidebar-inner">
              <div className="sidebar-header-v2">
                <h3>Filters</h3>
                <button onClick={() => setIsSidebarOpen(false)}><CloseIcon size={22} /></button>
              </div>

              <div className="filter-block">
                <h4 className="block-title">Filter by Category</h4>
                <div className="category-pills">
                  {dynamicCategories.map((cat) => (
                    <button 
                      key={cat} 
                      className={`cat-pill ${selectedCategories.includes(cat) ? 'active' : ''}`}
                      onClick={() => toggleCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-block">
                <h4 className="block-title">Price Range</h4>
                <div className="price-radio-group">
                  {[
                    { label: "All Prices", value: "all" },
                    { label: "Under Rs. 500", value: "under-500" },
                    { label: "Rs. 500 - 1000", value: "500-1000" },
                    { label: "Over Rs. 1000", value: "over-1000" }
                  ].map((range) => (
                    <label key={range.value} className="custom-radio">
                      <input
                        type="radio"
                        name="price"
                        checked={priceRange === range.value}
                        onChange={() => setPriceRange(range.value)}
                      />
                      <span className="radio-check"></span>
                      <span className="radio-label">{range.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Product Rails Showcase Area */}
          <div className="shop-grid-area rails-showcase-area">
            {hasAnyRail ? (
              <>
                {/* All Products Rail */}
                {selectedCategories.length === 0 && (
                  <ProductRail
                    title="All Products Collection"
                    subtitle={`Browse our entire catalog of ${categoryGroupedProducts.allProducts.length} items`}
                    products={categoryGroupedProducts.allProducts}
                    addToCart={handleAddToCart}
                    cartItems={cartItems}
                    getProductId={getProductId}
                    updateCartQuantity={updateCartQuantity}
                  />
                )}

                {/* Individual Category Rails */}
                {Object.entries(categoryGroupedProducts.categoriesMap).map(([categoryName, catProducts]) => (
                  <ProductRail
                    key={categoryName}
                    title={`${categoryName} Collection`}
                    subtitle={`Handcrafted ${categoryName.toLowerCase()} designed for modern spaces`}
                    products={catProducts}
                    addToCart={handleAddToCart}
                    cartItems={cartItems}
                    getProductId={getProductId}
                    updateCartQuantity={updateCartQuantity}
                  />
                ))}
              </>
            ) : (
              <div className="shop-empty-state">
                <Search size={48} />
                <h3>No products found</h3>
                <p>Try adjusting your filters or search query.</p>
                <button onClick={() => { setSelectedCategories([]); setPriceRange("all"); }}>
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Star({ size, fill }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export default function ShopPage() {
  return <ShopContent />;
}
