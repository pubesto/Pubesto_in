"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Minus, Plus, Star } from "lucide-react";
import { useStore } from "./StoreContext";
import { formatINR, getDiscountPercent, getOriginalPrice, getSalePrice } from "../lib/utils";

export function QuantityStepper({ quantity, onChange, size }) {
  return (
    <div className={`pb-stepper ${size ? `is-${size}` : ""}`}>
      <button type="button" onClick={() => onChange(quantity - 1)} aria-label="Decrease quantity">
        <Minus size={size === "lg" ? 18 : 14} strokeWidth={3} />
      </button>
      <motion.span key={quantity} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        {quantity}
      </motion.span>
      <button type="button" onClick={() => onChange(quantity + 1)} aria-label="Increase quantity">
        <Plus size={size === "lg" ? 18 : 14} strokeWidth={3} />
      </button>
    </div>
  );
}

export default function ProductCard({ product, index = 0 }) {
  const { cartItems, addToCart, getProductId, updateCartQuantity } = useStore();
  const productId = getProductId(product);
  const quantity = cartItems.find((item) => item.id === productId)?.quantity || 0;
  const outOfStock = product.inStock === false;
  const discount = getDiscountPercent(product);
  const sale = getSalePrice(product);
  const original = getOriginalPrice(product);
  const href = `/product/${product.slug}`;

  return (
    <motion.article
      className="pb-card"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: Math.min(index, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link className="pb-card-media" href={href} prefetch={false} aria-label={product.name}>
        <img src={product.image} alt={product.name} loading="lazy" decoding="async" />
        {outOfStock ? (
          <span className="pb-off-tag is-oos">Sold out</span>
        ) : discount > 0 ? (
          <span className="pb-off-tag">{discount}% OFF</span>
        ) : null}
      </Link>

      <div className="pb-card-body">
        <div className="pb-card-meta">
          {product.rating ? (
            <span className="pb-rating">
              {product.rating} <Star size={10} fill="currentColor" strokeWidth={0} />
            </span>
          ) : null}
          {product.reviews ? <span>({product.reviews})</span> : null}
          {product.categories?.[0] ? <span>· {product.categories[0]}</span> : null}
        </div>

        <Link href={href} prefetch={false}>
          <h3 className="pb-card-title">{product.name}</h3>
        </Link>

        <div className="pb-card-foot">
          <div className="pb-price">
            <strong>{formatINR(sale)}</strong>
            {original > sale ? <s>{formatINR(original)}</s> : null}
          </div>

          {outOfStock ? (
            <button className="pb-add" type="button" disabled>
              N/A
            </button>
          ) : quantity > 0 ? (
            <QuantityStepper quantity={quantity} onChange={(next) => updateCartQuantity(productId, next)} />
          ) : (
            <button className="pb-add" type="button" onClick={() => addToCart(product, { openCart: false })}>
              ADD
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
