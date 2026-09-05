"use client";

import "./hero.css";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ShoppingBag,
  Sparkles,
  Plus,
  Minus,
  Check,
  Volume2,
  VolumeX
} from "lucide-react";
import Link from "next/link";
import { useStore } from "../components/StoreContext";
import {
  heroSlides,
  peopleChoiceVideos,
  socialGalleryItems,
  storeConfig
} from "../lib/data";
import { formatPrice } from "../lib/utils";


function ProductCard({ product, index = 0 }) {
  const { 
    cartItems, addToCart, removeFromCart, getProductId, updateCartQuantity
  } = useStore();
  const [addEffectKey, setAddEffectKey] = useState(null);

  const cartQuantity = cartItems.find((item) => item.id === getProductId(product))?.quantity || 0;

  function showAddAnimation() {
    const nextKey = Date.now();
    setAddEffectKey(nextKey);
    window.setTimeout(() => {
      setAddEffectKey((currentKey) => (currentKey === nextKey ? null : currentKey));
    }, 1050);
  }

  function handleAddToCart(options) {
    if (product.inStock === false) return;



    showAddAnimation();
    addToCart(product, options);
  }

  function handleRemoveFromCart() {
    removeFromCart(getProductId(product));
  }

  const parsePrice = (priceStr) => {
    const num = Number((priceStr || '').replace(/[^\d.]/g, ''));
    return isNaN(num) || num === 0 ? null : num;
  };

  const getDynamicBadge = () => {
    if (product.inStock === false) return "Out of Stock";
    const sale = product.salePrice || parsePrice(product.price);
    const original = product.originalPrice || parsePrice(product.oldPrice);
    if (sale && original && original > sale) {
      return `${Math.round(((original - sale) / original) * 100)}% OFF`;
    }
    return product.badge;
  };

  const activeBadge = getDynamicBadge();
  const badgeClass = product.inStock === false ? "badge-out-of-stock" : (product.badgeClass || "badge-discount");

  return (
    <motion.article
      className="product-card"
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.04 }}
      viewport={{ once: true, margin: "-50px" }}
    >
      <div className="product-media">
        <Link className="product-media-link" href={`/product/${product.slug}`} aria-label={`View ${product.name}`} prefetch={false}>
          <img src={product.image} alt={product.name} loading="lazy" decoding="async" />
        </Link>
        {activeBadge ? (
          <span className={`badge ${badgeClass}`}>{activeBadge}</span>
        ) : null}
        {product.inStock !== false && (
          <button
            className="card-quick-add-plus"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleAddToCart();
            }}
            aria-label="Quick add to cart"
          >
            <Plus size={18} />
          </button>
        )}
        <AnimatePresence>
          {addEffectKey ? (
            <motion.div
              className="premium-add-animation"
              key={addEffectKey}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.05, ease: "easeOut" }}
              aria-hidden="true"
            >
              <span className="premium-add-glow" />
              <span className="premium-add-ring ring-one" />
              <span className="premium-add-ring ring-two" />
              <span className="premium-add-sparkle sparkle-one"><Sparkles /></span>
              <span className="premium-add-sparkle sparkle-two"><Sparkles /></span>
              <span className="premium-add-sparkle sparkle-three"><Sparkles /></span>
              <motion.span
                className="premium-add-chip"
                initial={{ opacity: 0, y: 16, scale: 0.9 }}
                animate={{ opacity: [0, 1, 1, 0], y: [16, 0, -6, -18], scale: [0.9, 1, 1, 0.96] }}
                transition={{ duration: 1.05, ease: "easeOut" }}
              >
                <ShoppingBag />
                Added
              </motion.span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <div className="product-body">
        <Link href={`/product/${product.slug}`} prefetch={false}>
          <h3>{product.name}</h3>
        </Link>
        <p className="price">
          {product.price}
          {product.oldPrice ? <span>{product.oldPrice}</span> : null}
        </p>
        {product.inStock === false ? (
          <button className="quick-add disabled" disabled>Out of Stock</button>
        ) : cartQuantity > 0 ? (
          <div className="product-quantity-selector">
            <button 
              type="button" 
              onClick={() => updateCartQuantity(getProductId(product), cartQuantity - 1)}
              aria-label="Decrease quantity"
            >
              <Minus size={16} />
            </button>
            <span>{cartQuantity}</span>
            <button 
              type="button" 
              onClick={() => updateCartQuantity(getProductId(product), cartQuantity + 1)}
              aria-label="Increase quantity"
            >
              <Plus size={16} />
            </button>
          </div>
        ) : (
          <button
            className="quick-add"
            type="button"
            onClick={() => handleAddToCart()}
          >
            Add to Cart
          </button>
        )}
      </div>
    </motion.article>
  );
}

function HomeContent() {
  const {
    selectedCategory, setSelectedCategory,
    searchQuery, setSearchQuery,
    showAllProducts, setShowAllProducts,
    categories, products
  } = useStore();

  const [showAllCategories, setShowAllCategories] = useState(false);
  const [activeSoundVideo, setActiveSoundVideo] = useState(null);
  const [heroSoundOn, setHeroSoundOn] = useState(false);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const activeProducts = (products || []).filter((product) => {
    if (!product || !product.image) return false;
    const img = String(product.image);
    const hasRealImage = img.startsWith('/images/') || img.includes('shopify.com');
    const isNotDummy = !img.includes('unsplash.com');
    return hasRealImage && isNotDummy;
  });
  
  const categoryFilteredProducts = selectedCategory
    ? activeProducts.filter((product) =>
        selectedCategory.name === "Sale"
          ? product.oldPrice
          : product.categories?.some(cat => cat.toLowerCase() === selectedCategory.name.toLowerCase())
      )
    : activeProducts;

  const filteredProducts = normalizedSearchQuery
    ? categoryFilteredProducts.filter((product) =>
        product.name.toLowerCase().includes(normalizedSearchQuery) ||
        product.description?.toLowerCase().includes(normalizedSearchQuery) ||
        product.categories?.some(cat => cat.toLowerCase().includes(normalizedSearchQuery))
      )
    : categoryFilteredProducts;

  const deduplicatedProducts = filteredProducts.reduce((acc, current) => {
    const x = acc.find(item => item.slug === current.slug);
    if (!x) {
      return acc.concat([current]);
    } else {
      return acc;
    }
  }, []);

  const visibleProducts = showAllProducts ? deduplicatedProducts : deduplicatedProducts.slice(0, 8);

  const productEyebrow = normalizedSearchQuery
    ? `${filteredProducts.length} result${filteredProducts.length === 1 ? "" : "s"} for "${searchQuery.trim()}"`
    : selectedCategory
      ? `Showing ${categoryFilteredProducts.length} product${categoryFilteredProducts.length === 1 ? "" : "s"}`
      : "Customer favourites";

  const productHeading = normalizedSearchQuery
    ? "Search results"
    : selectedCategory
      ? `${selectedCategory.label || selectedCategory.name} products`
      : "Featured products";

  // Dynamic marquee calculations to prevent gaps on ultra-wide screens
  const minRequiredWidth = 6000;
  const estimatedItemWidth = 160;
  const copyWidth = Math.max(categories.length, 1) * estimatedItemWidth;
  let numCopies = Math.ceil(minRequiredWidth / copyWidth);
  if (numCopies % 2 !== 0) numCopies += 1;
  const translatedCopies = numCopies / 2;
  const marqueeDuration = translatedCopies * 25;
  const displayCategories = showAllCategories 
    ? categories 
    : Array(numCopies).fill(categories).flat();

  return (
    <>
      <main>
        <section className="hero-section" aria-label="Featured offers">
          <div className="hero-overflow-container">
            <div className={`hero-flex-container ${heroSlides.length === 1 ? "is-static" : "is-animating"}`}>
              {(heroSlides.length > 1 ? [...heroSlides, heroSlides[0]] : heroSlides).map((slide, index) => {
                const isDuplicateSlide = heroSlides.length > 1 && index === heroSlides.length;
                return (
                  <article 
                    className={`hero-slide-item ${slide.video ? "has-video" : ""}`} 
                    aria-hidden={isDuplicateSlide} 
                    key={`${slide.title}-${index}`}
                  >
                    {/* Background Layer */}
                    <div className="hero-slide-bg">
                      {slide.video ? (
                        <video 
                          className="hero-media-bg" 
                          autoPlay 
                          muted={!heroSoundOn || isDuplicateSlide} 
                          loop 
                          playsInline 
                          preload="auto" 
                          poster={slide.image}
                        >
                          <source src={slide.video} type="video/mp4" />
                        </video>
                      ) : (
                        <img className="hero-media-bg" src={slide.image} alt="" />
                      )}
                      <div className="hero-slide-overlay" />
                    </div>

                    {/* Content Container */}
                    <div className="hero-slide-container">
                      <div className="hero-slide-layout">
                        {/* Text Content */}
                        <motion.div 
                          className="hero-content-card"
                          initial={{ opacity: 0, y: 30 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                          viewport={{ once: true }}
                        >
                          <span className="hero-eyebrow-tag">{slide.eyebrow}</span>
                          <h2 className="hero-title">{slide.title}</h2>
                          <Link href={slide.link} className="hero-primary-cta">
                            {slide.cta}
                          </Link>
                        </motion.div>

                        {/* Floating Product Card Removed */}
                      </div>
                    </div>

                    {/* Sound Toggle */}
                    {slide.video && !isDuplicateSlide && (
                      <button
                        className={`hero-sound-control ${heroSoundOn ? "is-active" : ""}`}
                        type="button"
                        title={heroSoundOn ? "Mute hero video" : "Unmute hero video"}
                        onClick={(event) => {
                          const video = event.currentTarget.closest('.hero-slide-item')?.querySelector("video");
                          const shouldUnmute = !heroSoundOn;

                          document.querySelectorAll(".video-choice-video").forEach((v) => v.muted = true);
                          setActiveSoundVideo(null);

                          if (video) {
                            video.muted = !shouldUnmute;
                            video.volume = 1;
                            if (shouldUnmute) video.play().catch(() => {});
                          }
                          setHeroSoundOn(shouldUnmute);
                        }}
                      >
                        {heroSoundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>

            {/* Progress Indicators */}
            {heroSlides.length > 1 && (
              <div className="hero-indicators">
                {heroSlides.map((_, i) => (
                  <div key={i} className="hero-indicator-dot">
                    <div 
                      className="hero-indicator-progress" 
                      style={{ 
                        animation: `hero-progress-fill 6s linear infinite`,
                        animationDelay: `${i * 3}s`
                      }} 
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="video-choice-section" aria-labelledby="people-choice-title">
          <div className="video-choice-heading">
            <p>Shop from videos</p>
            <h2 id="people-choice-title">People&apos;s choice</h2>
          </div>
          <div className="video-choice-scroll" role="list">
            {peopleChoiceVideos.map((item) => {
              const isSoundOn = activeSoundVideo === item.title;

              return (
                <article className="video-choice-card" role="listitem" key={item.title}>
                  <Link className="video-choice-card-link" href={`/product/${item.slug}`} aria-label={`Shop ${item.title}`}>
                    {item.video && !item.video.includes('pin.it') ? (
                      <video className="video-choice-video" autoPlay muted={!isSoundOn} loop playsInline preload="auto" poster={item.image}>
                        <source src={item.video} type="video/mp4" />
                      </video>
                    ) : (
                      <img className="video-choice-video simulated-video" src={item.image} alt={item.title} loading="lazy" decoding="async" />
                    )}
                    <span className="video-choice-gradient" />
                    <span className="video-choice-product">
                      <span className="video-choice-thumb"><img src={item.thumb} alt="" loading="lazy" decoding="async" /></span>
                      <span className="video-choice-copy">
                        <strong>{item.title}</strong>
                      </span>
                    </span>
                  </Link>
                  {item.video && !item.video.includes('pin.it') ? (
                    <button
                      className={`video-choice-sound ${isSoundOn ? "active" : ""}`}
                      type="button"
                      title={isSoundOn ? "Mute sound" : "Unmute sound"}
                      aria-label={`${isSoundOn ? "Mute" : "Unmute"} ${item.title}`}
                      aria-pressed={isSoundOn}
                      onClick={(event) => {
                        const video = event.currentTarget.parentElement?.querySelector("video");
                        if (!video) return;

                        const shouldUnmute = activeSoundVideo !== item.title;
                        document.querySelectorAll(".hero-media-bg").forEach((videoElement) => {
                          if (videoElement.tagName === 'VIDEO') videoElement.muted = true;
                        });
                        document.querySelectorAll(".video-choice-video").forEach((videoElement) => {
                          if (videoElement.tagName === 'VIDEO') videoElement.muted = true;
                        });
                        // Assume setHeroSoundOn is available from context or state
                        if (typeof setHeroSoundOn === 'function') setHeroSoundOn(false);

                        if (shouldUnmute) {
                          video.muted = false;
                          video.volume = 1;
                          video.play().catch(() => {});
                          setActiveSoundVideo(item.title);
                        } else {
                          video.muted = true;
                          setActiveSoundVideo(null);
                        }
                      }}
                    >
                      {isSoundOn ? <Volume2 /> : <VolumeX />}
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section id="categories" className="category-section">
          <div className="section-heading centered">
            <div>
              <p className="eyebrow">Shop the range</p>
              <h2>Browse by category</h2>
            </div>
            {/* View all button removed from categories */}
          </div>
          <div className={showAllCategories ? "category-grid" : "category-scroll-container"}>
            <motion.div
              className={showAllCategories ? "category-grid-inner" : "category-marquee"}
              animate={showAllCategories ? { x: 0 } : { x: [0, "-50%"] }}
              transition={{ 
                x: { 
                  repeat: Infinity, 
                  duration: marqueeDuration, 
                  ease: "linear",
                  repeatType: "loop"
                } 
              }}
            >
              {displayCategories.map((category, index) => (
                <button
                  className={`category-tile ${category.name === "Sale" ? "sale" : ""} ${selectedCategory?.name === category.name ? "selected" : ""}`}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(category);
                    setShowAllProducts(true);
                    setTimeout(() => {
                      document.getElementById("featured")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 100);
                  }}
                  key={`${category.name}-${index}`}
                >
                  <img src={category.image} alt="" loading="lazy" decoding="async" />
                  <span>{category.name}</span>
                </button>
              ))}
            </motion.div>
          </div>
        </section>

        <section id="featured" className="product-section">
          <div className="section-heading centered">
            <div>
              <p className="eyebrow">{productEyebrow}</p>
              <h2>{productHeading}</h2>
            </div>
            <div className="section-actions">
              {selectedCategory && (
                <button 
                  className="view-all btn-clear-filter" 
                  type="button" 
                  onClick={() => setSelectedCategory(null)}
                >
                  Clear Filter
                </button>
              )}
              <button className="view-all" type="button" onClick={() => setShowAllProducts((v) => !v)}>
                {showAllProducts ? "Show less" : "See more"} <span>&gt;</span>
              </button>
            </div>
          </div>
          <div className="product-grid">
            {visibleProducts.map((product, idx) => (
              <ProductCard product={product} key={product.name} index={idx} />
            ))}
          </div>
        </section>

        <section className="social-home-section" aria-labelledby="social-circle-title">
          <motion.div
            className="section-heading centered social-circle-heading"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            viewport={{ once: true, margin: "-100px" }}
          >
            <div>
              <p className="eyebrow">Follow Us</p>
              <h2 id="social-circle-title">Join the Pubesto Home Circle</h2>
            </div>
          </motion.div>

          <div className="social-circle-section">
            <div className="social-gallery" role="list">
            {socialGalleryItems.map((item, index) => {
              const isExternal = item.link && (item.link.startsWith("http://") || item.link.startsWith("https://"));

              return (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: index * 0.08, ease: [0.215, 0.61, 0.355, 1] }}
                  viewport={{ once: true, margin: "-80px" }}
                  key={item.title}
                  style={{ display: "flex", width: "100%" }}
                >
                  <Link
                    href={item.link || "/shop"}
                    className="social-gallery-card"
                    role="listitem"
                    style={{ width: "100%" }}
                    target={isExternal ? "_blank" : undefined}
                    rel={isExternal ? "noopener noreferrer" : undefined}
                  >
                    <div className="social-gallery-image-wrapper">
                      <img src={item.image} alt={item.title} loading="lazy" decoding="async" />
                    </div>
                    <div className="social-gallery-info">
                      <span className="social-gallery-card-num">0{index + 1}</span>
                      <h3 className="social-gallery-card-title">{item.title}</h3>
                      <p className="social-gallery-card-caption">{item.caption}</p>
                      <div className="social-gallery-card-cta">
                        <span>{isExternal ? "View on Instagram" : "Explore Collection"}</span>
                        <span className="arrow">→</span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
            </div>
          </div>
        </section>


      </main>
    </>
  );
}

export default function Home() {
  return <HomeContent />;
}
