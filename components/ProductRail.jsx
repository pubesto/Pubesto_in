"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "./ProductCard";

export default function ProductRail({ title, subtitle, eyebrow, products, href }) {
  const trackRef = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  function updateEdges() {
    const el = trackRef.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  }

  useEffect(() => {
    updateEdges();
    window.addEventListener("resize", updateEdges);
    return () => window.removeEventListener("resize", updateEdges);
  }, [products?.length]);

  function scroll(direction) {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }

  if (!products?.length) return null;

  return (
    <section className="pb-section">
      <div className="pb-section-head">
        <div>
          {eyebrow ? <div className="pb-eyebrow">{eyebrow}</div> : null}
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {href ? (
          <Link className="pb-see-all" href={href} prefetch={false}>
            See all <ChevronRight size={16} />
          </Link>
        ) : null}
      </div>
      <div className="pb-rail">
        <button className="pb-rail-arrow is-left" type="button" onClick={() => scroll(-1)} hidden={edges.start} aria-label="Scroll left">
          <ChevronLeft size={20} />
        </button>
        <div className="pb-rail-track" ref={trackRef} onScroll={updateEdges}>
          {products.map((product, index) => (
            <ProductCard key={product.slug || product.name} product={product} index={index} />
          ))}
        </div>
        <button className="pb-rail-arrow is-right" type="button" onClick={() => scroll(1)} hidden={edges.end} aria-label="Scroll right">
          <ChevronRight size={20} />
        </button>
      </div>
    </section>
  );
}
