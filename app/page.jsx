"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,

  PackageCheck,
  RotateCcw,
  ShieldCheck,
  Star,
  Truck,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { useStore } from "../components/StoreContext";
import { InstagramIcon } from "../components/Icons";
import ProductRail from "../components/ProductRail";
import { useVisibleCategories } from "../components/Header";
import { heroSlides, peopleChoiceVideos, socialGalleryItems } from "../lib/data";
import { formatINR, getDiscountPercent, getListableProducts, getOriginalPrice, getSalePrice, parsePriceValue } from "../lib/utils";

const CATEGORY_TINTS = ["#e7f6ee", "#fff4d6", "#e8f0ff", "#fde8ec", "#efe9ff", "#e3f7f7", "#fff0e3"];
const SLIDE_MS = 6000;

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
};

function Hero({ products }) {
  const [index, setIndex] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const slide = heroSlides[index];

  useEffect(() => {
    if (heroSlides.length < 2) return undefined;
    const id = setTimeout(() => setIndex((i) => (i + 1) % heroSlides.length), SLIDE_MS);
    return () => clearTimeout(id);
  }, [index]);

  // Prefer the live Shopify price of the linked product so the banner never shows a
  // different price than the product page and checkout.
  const linkedSlug = slide.link?.split("/product/")[1]?.split(/[?#]/)[0];
  const linkedProduct = linkedSlug ? products.find((p) => p.slug === linkedSlug || p.slugAliases?.includes(linkedSlug) || p.shopifyHandle === linkedSlug) : null;
  const sale = linkedProduct ? getSalePrice(linkedProduct) : parsePriceValue(slide.price);
  const original = linkedProduct ? getOriginalPrice(linkedProduct) : parsePriceValue(slide.oldPrice);
  const off = sale && original > sale ? Math.round(((original - sale) / original) * 100) : 0;

  const dealProduct = useMemo(
    () => [...products].sort((a, b) => getDiscountPercent(b) - getDiscountPercent(a))[0],
    [products]
  );
  const prepaidProduct = products.find((p) => p.slug?.includes("notebook")) || products[1];

  return (
    <section className="pb-hero" aria-label="Featured offers">
      <div className="pb-hero-main">
        <AnimatePresence initial={false}>
          <motion.div
            key={index}
            className="pb-hero-slide"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
          >
            {slide.video ? (
              <video src={slide.video} poster={slide.image} autoPlay muted={!soundOn} loop playsInline />
            ) : (
              <motion.img
                src={slide.image}
                alt=""
                initial={{ scale: 1.08 }}
                animate={{ scale: 1 }}
                transition={{ duration: SLIDE_MS / 1000 + 1, ease: "linear" }}
              />
            )}
          </motion.div>
        </AnimatePresence>

        <motion.div
            key={index}
            className="pb-hero-copy"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="pb-hero-tag"><Zap size={13} fill="currentColor" /> {slide.eyebrow}</span>
            <h1>{slide.title}</h1>
            {slide.copy ? <p>{slide.copy}</p> : null}
            {sale ? (
              <div className="pb-hero-price">
                <strong>{formatINR(sale)}</strong>
                {original > sale ? <s>{formatINR(original)}</s> : null}
                {off ? <em>{off}% OFF</em> : null}
              </div>
            ) : null}
            <Link className="pb-btn pb-btn-turq" href={slide.link} prefetch={false}>
              {slide.cta || "Shop now"} <ArrowRight size={18} />
            </Link>
          </motion.div>

        {slide.video ? (
          <button className="pb-reel-sound" style={{ zIndex: 4, top: 16, right: 16 }} type="button" onClick={() => setSoundOn((v) => !v)} aria-label={soundOn ? "Mute" : "Unmute"}>
            {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        ) : null}

        {heroSlides.length > 1 ? (
          <div className="pb-hero-dots">
            {heroSlides.map((s, i) => (
              <button key={s.title} type="button" className={i === index ? "is-active" : ""} onClick={() => setIndex(i)} aria-label={`Show slide ${i + 1}`}>
                <span key={i === index ? index : undefined} />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="pb-hero-side">
        <Link className="pb-promo is-turq" href="/shop" prefetch={false}>
          <div>
            <h3>Extra 10% off on prepaid</h3>
            <p>Pay via UPI, cards or netbanking and save instantly.</p>
          </div>
          <span className="pb-promo-cta">Shop now <ArrowRight size={15} /></span>
          {prepaidProduct ? <img src={prepaidProduct.image} alt="" /> : null}
        </Link>
        <Link className="pb-promo is-blue" href="/shop?category=Sale" prefetch={false}>
          <div>
            <h3>Deals up to {getDiscountPercent(dealProduct) || 40}% off</h3>
            <p>Bestselling gadgets at their lowest prices.</p>
          </div>
          <span className="pb-promo-cta">Grab deals <ArrowRight size={15} /></span>
          {dealProduct ? <img src={dealProduct.image} alt="" /> : null}
        </Link>
      </div>
    </section>
  );
}

function UspStrip() {
  const items = [
    { icon: Truck, title: "Free shipping", text: "On orders above ₹500" },
    { icon: Zap, title: "Extra 10% off", text: "On every prepaid order" },
    { icon: RotateCcw, title: "Easy returns", text: "7-day hassle-free" },
    { icon: ShieldCheck, title: "Secure payments", text: "UPI, cards & COD" },
  ];
  return (
    <div className="pb-usps">
      {items.map(({ icon: Icon, title, text }, i) => (
        <motion.div key={title} className="pb-usp" {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.06 }}>
          <span className="pb-usp-ico"><Icon size={20} /></span>
          <span>
            <strong>{title}</strong>
            <small>{text}</small>
          </span>
        </motion.div>
      ))}
    </div>
  );
}

function CategoryGrid() {
  const categories = useVisibleCategories();
  if (!categories.length) return null;

  return (
    <section className="pb-section">
      <div className="pb-section-head">
        <div>
          <h2>Shop by category</h2>
          <p>Everything you need, neatly sorted.</p>
        </div>
        <Link className="pb-see-all" href="/shop" prefetch={false}>
          View all <ChevronRight size={16} />
        </Link>
      </div>
      <div className="pb-cats">
        {categories.map((category, i) => (
          <motion.div key={category.name} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.05 }}>
            <Link
              className={`pb-cat ${category.name === "Sale" ? "is-sale" : ""}`}
              href={`/shop?category=${encodeURIComponent(category.name)}`}
              prefetch={false}
            >
              <span className="pb-cat-img" style={{ "--cat-bg": CATEGORY_TINTS[i % CATEGORY_TINTS.length] }}>
                <img src={category.image} alt="" loading="lazy" decoding="async" />
              </span>
              {category.label || category.name}
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function VideoReels({ products }) {
  const [soundFor, setSoundFor] = useState(null);
  const reels = peopleChoiceVideos.filter((item) => item.video && !item.video.includes("pin.it"));
  if (!reels.length) return null;

  return (
    <section className="pb-section">
      <div className="pb-section-head">
        <div>
          <div className="pb-eyebrow">Shop from videos</div>
          <h2>See it in action</h2>
          <p>Real products, real use — tap to shop what you see.</p>
        </div>
      </div>
      <div className="pb-reels">
        {reels.map((item, i) => {
          const product = products.find((p) => p.slug === item.slug);
          const sale = product ? getSalePrice(product) : parsePriceValue(item.price);
          const original = product ? getOriginalPrice(product) : parsePriceValue(item.oldPrice);
          const soundOn = soundFor === item.title;
          return (
            <motion.article key={item.title} className="pb-reel" {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.06 }}>
              <Link href={`/product/${item.slug}`} prefetch={false} aria-label={`Shop ${item.title}`}>
                <video src={item.video} poster={item.image} autoPlay muted={!soundOn} loop playsInline preload="metadata" />
                <span className="pb-reel-live">Trending</span>
                <span className="pb-reel-product">
                  <img src={product?.image || item.thumb} alt="" />
                  <div>
                    <strong>{product?.name || item.title}</strong>
                    {sale ? (
                      <span>
                        {formatINR(sale)}
                        {original > sale ? <s>{formatINR(original)}</s> : null}
                      </span>
                    ) : null}
                  </div>
                  <ChevronRight size={18} />
                </span>
              </Link>
              <button
                className="pb-reel-sound"
                type="button"
                onClick={() => setSoundFor(soundOn ? null : item.title)}
                aria-label={soundOn ? `Mute ${item.title}` : `Unmute ${item.title}`}
                aria-pressed={soundOn}
              >
                {soundOn ? <Volume2 size={17} /> : <VolumeX size={17} />}
              </button>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}

function OfferBand() {
  return (
    <motion.section className="pb-section" {...fadeUp}>
      <div className="pb-offer-band">
        <div>
          <div className="pb-eyebrow"><Zap size={13} fill="currentColor" /> Smart saver</div>
          <h2>Pay online, <span>save 10% more.</span></h2>
          <p>Every prepaid order gets an instant extra 10% off — on top of already discounted prices. No coupon needed.</p>
          <Link className="pb-btn pb-btn-turq" href="/shop" prefetch={false}>
            Start saving <ArrowRight size={18} />
          </Link>
        </div>
        <div className="pb-offer-steps">
          {[
            { title: "Add your favourites", text: "Fill your cart with bestsellers" },
            { title: "Choose “Pay online”", text: "UPI, cards or netbanking" },
            { title: "10% off, instantly", text: "Applied automatically at checkout" },
          ].map((step, i) => (
            <div key={step.title} className="pb-offer-step">
              <b>{i + 1}</b>
              <span>
                <strong>{step.title}</strong>
                <small>{step.text}</small>
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

function getInitials(name) {
  return (name || "?").split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2);
}

function Reviews() {
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    let active = true;
    fetch("/api/reviews?scope=home")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => active && setReviews(data?.reviews || []))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!reviews.length) return null;

  return (
    <section className="pb-section">
      <div className="pb-section-head">
        <div>
          <div className="pb-eyebrow"><Star size={13} fill="currentColor" /> Customer love</div>
          <h2>What our customers say</h2>
        </div>
      </div>
      <div className="pb-reviews">
        {reviews.slice(0, 8).map((review) => (
          <article key={review.id} className="pb-review">
            <span className="pb-stars" aria-label={`${review.rating} out of 5 stars`}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} size={15} fill={i < Math.round(review.rating) ? "currentColor" : "none"} />
              ))}
            </span>
            <p>&ldquo;{review.text}&rdquo;</p>
            <div className="pb-review-who">
              <span className="pb-avatar">{review.initials || getInitials(review.customerName)}</span>
              <span>
                <strong>{review.customerName}</strong>
                {review.productName ? <small><BadgeCheck size={13} /> Bought {review.productName}</small> : null}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SocialGallery() {
  return (
    <section className="pb-section">
      <div className="pb-section-head">
        <div>
          <div className="pb-eyebrow"><InstagramIcon size={13} /> @pubesto_official</div>
          <h2>Join the Pubesto circle</h2>
        </div>
        <a className="pb-see-all" href="https://www.instagram.com/pubesto_official/" target="_blank" rel="noreferrer">
          Follow us <ChevronRight size={16} />
        </a>
      </div>
      <div className="pb-social">
        {socialGalleryItems.map((item, i) => {
          const external = /^https?:\/\//.test(item.link || "");
          return (
            <motion.div key={item.title} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.06 }}>
              <Link
                className="pb-social-card"
                href={item.link || "/shop"}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                prefetch={false}
              >
                <img src={item.image} alt="" loading="lazy" decoding="async" />
                <h3>{item.title}</h3>
                <p>{item.caption}</p>
                <span>{external ? "View on Instagram" : "Explore"} <ArrowRight size={14} /></span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

export default function Home() {
  const { products } = useStore();
  const categories = useVisibleCategories();
  const listable = useMemo(() => getListableProducts(products), [products]);

  const bestsellers = useMemo(
    () => [...listable].sort((a, b) => (Number(b.reviews) || 0) - (Number(a.reviews) || 0)).slice(0, 12),
    [listable]
  );
  const deals = useMemo(
    () => listable.filter((p) => getDiscountPercent(p) > 0).sort((a, b) => getDiscountPercent(b) - getDiscountPercent(a)).slice(0, 12),
    [listable]
  );
  const categoryRails = useMemo(
    () =>
      categories
        .filter((c) => c.name !== "Sale")
        .map((c) => ({
          ...c,
          items: listable.filter((p) => (p.categories || []).some((pc) => pc.toLowerCase() === c.name.toLowerCase())),
        }))
        .filter((c) => c.items.length >= 3)
        .slice(0, 3),
    [categories, listable]
  );

  return (
    <main>
      <div className="pb-container">
        <Hero products={listable} />
        <UspStrip />
        <CategoryGrid />
        <ProductRail eyebrow="🔥 Most loved" title="Bestsellers" subtitle="The picks everyone keeps coming back for." products={bestsellers} href="/shop" />
        <VideoReels products={listable} />
        <ProductRail eyebrow="Limited-time prices" title="Top deals for you" products={deals} href="/shop?category=Sale" />
        <OfferBand />
        {categoryRails.map((category) => (
          <ProductRail
            key={category.name}
            title={category.label || category.name}
            products={category.items}
            href={`/shop?category=${encodeURIComponent(category.name)}`}
          />
        ))}
        <Reviews />
        <SocialGallery />
        <section className="pb-section">
          <div className="pb-usps" style={{ marginTop: 0 }}>
            {[
              { icon: PackageCheck, title: "Quality checked", text: "Every product inspected" },
              { icon: Truck, title: "Pan-India delivery", text: "Fast dispatch" },
              { icon: ShieldCheck, title: "100% secure", text: "Trusted payment partners" },
              { icon: RotateCcw, title: "Easy returns", text: "Simple 7-day process" },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="pb-usp">
                <span className="pb-usp-ico"><Icon size={20} /></span>
                <span>
                  <strong>{title}</strong>
                  <small>{text}</small>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
