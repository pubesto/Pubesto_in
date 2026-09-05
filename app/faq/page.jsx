"use client";

import React, { useState } from "react";
import { ChevronDown, HelpCircle, Search, Sparkles } from "lucide-react";
import Link from "next/link";

const faqData = [
  {
    category: "General & Products",
    questions: [
      {
        q: "What products does Pubesto offer?",
        a: "Pubesto curates high-quality, practical daily essentials for modern Indian homes. Our selection focuses on leak-proof stainless steel water bottles, insulated lunch boxes, home decor, bladeless neck fans, and practical kitchen utility items designed for durability."
      },
      {
        q: "Are your kitchen and bottle products food-safe?",
        a: "Absolutely. All Pubesto bottles, containers, and kitchenware items are made from premium, BPA-free, food-grade materials such as high-grade 304 stainless steel. They are designed to keep your food and beverages fresh, safe, and toxin-free."
      },
      {
        q: "How do I care for my stainless steel bottles and lunch boxes?",
        a: "We recommend washing them with warm water and mild dish soap using a soft sponge. Avoid using abrasive scrubbers or steel wool. To maintain the vacuum insulation, do not place insulated bottles in the freezer or microwave."
      }
    ]
  },
  {
    category: "Shipping & Delivery",
    questions: [
      {
        q: "Do you ship all over India?",
        a: "Yes, we ship to almost all pincodes across India. We partner with reliable shipping carriers to ensure your order arrives safely and on time."
      },
      {
        q: "What are the shipping charges and delivery timelines?",
        a: "We offer free standard shipping on orders above Rs. 500. For orders below Rs. 500, a flat shipping fee of Rs. 70 is charged. Deliveries generally take 3 to 7 business days, depending on your location."
      },
      {
        q: "How can I track my package?",
        a: "Once your package is shipped, a shipping confirmation email and SMS containing a tracking link will be sent. You can use this link to track your order status in real-time."
      }
    ]
  },
  {
    category: "Orders & Payments",
    questions: [
      {
        q: "What payment options do you support?",
        a: "We accept a wide range of secure payment options, including UPI (Google Pay, PhonePe, Paytm), Net Banking, major Credit/Debit Cards, and digital wallets. Payments are processed through trusted, encrypted gateways."
      },
      {
        q: "Do you offer Cash on Delivery (COD)?",
        a: "To ensure the fastest dispatch times and secure contactless delivery, we operate as a 100% prepaid store. We accept all major secure payment methods, including UPI (Google Pay, PhonePe, Paytm), Net Banking, and major Debit/Credit Cards."
      },
      {
        q: "Can I modify or cancel my order after placing it?",
        a: "Since we process orders quickly to ensure rapid delivery, you can only make changes or cancel within 2 hours of placing the order. Please email support@pubesto.com or call +91 7056063693 immediately with your order details."
      }
    ]
  },
  {
    category: "Returns & Refunds",
    questions: [
      {
        q: "What is the return and replacement policy?",
        a: "We offer a hassle-free 7-day return policy for unused items in their original packaging. If you receive a damaged, defective, or incorrect product, please notify us within 48 hours of delivery to arrange a free replacement."
      },
      {
        q: "When will I receive my refund?",
        a: "Once we receive your return shipment and inspect the product's condition, we will process your refund within 3 to 5 business days. The refund will be credited directly to your original payment source or bank account."
      }
    ]
  }
];

export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIndices, setActiveIndices] = useState({});

  const toggleAccordion = (catIndex, qIndex) => {
    const key = `${catIndex}-${qIndex}`;
    setActiveIndices((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Filter FAQs based on search query
  const filteredFaq = faqData.map((cat, catIndex) => {
    const questions = cat.questions.filter(
      (item) =>
        item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.a.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return { ...cat, questions, catIndex };
  }).filter((cat) => cat.questions.length > 0);

  return (
    <main style={{ minHeight: "100vh", background: "var(--off-white)", padding: "120px 20px 80px", position: "relative" }}>
      {/* Decorative background glow */}
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: "1200px", height: "400px", background: "radial-gradient(circle, rgba(27,98,75,0.06) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ maxWidth: "800px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(27, 98, 75, 0.08)", color: "var(--brand-color)", padding: "6px 16px", borderRadius: "20px", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "16px" }}>
            <Sparkles size={14} /> Help Center
          </div>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-display)", fontStyle: "italic", margin: "0 0 12px" }}>
            Frequently Asked Questions
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "16px", maxWidth: "500px", margin: "0 auto 30px", lineHeight: 1.6 }}>
            Have questions about orders, products, shipping, or returns? Find quick answers below.
          </p>

          {/* Search bar */}
          <div style={{ position: "relative", maxWidth: "480px", margin: "0 auto" }}>
            <Search size={18} style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input
              type="text"
              placeholder="Search questions or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "16px 16px 16px 48px",
                borderRadius: "30px",
                border: "1px solid rgba(211, 201, 189, 0.8)",
                background: "var(--panel)",
                color: "var(--ink)",
                fontSize: "14px",
                outline: "none",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.03)",
                transition: "all 0.3s ease"
              }}
            />
          </div>
        </div>

        {/* FAQ Content */}
        {filteredFaq.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            {filteredFaq.map((category) => (
              <section key={category.category}>
                <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--brand-color)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px", borderBottom: "1px solid rgba(211, 201, 189, 0.4)", paddingBottom: "8px" }}>
                  {category.category}
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {category.questions.map((faq, qIdx) => {
                    const isOpen = !!activeIndices[`${category.catIndex}-${qIdx}`];
                    return (
                      <article
                        key={faq.q}
                        style={{
                          background: "var(--panel)",
                          border: "1px solid rgba(211, 201, 189, 0.5)",
                          borderRadius: "12px",
                          overflow: "hidden",
                          transition: "all 0.3s ease"
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleAccordion(category.catIndex, qIdx)}
                          style={{
                            width: "100%",
                            padding: "20px",
                            background: "transparent",
                            border: "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            cursor: "pointer",
                            textAlign: "left",
                            gap: "16px"
                          }}
                        >
                          <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)", lineHeight: 1.4 }}>
                            {faq.q}
                          </span>
                          <span
                            style={{
                              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                              color: "var(--brand-color)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "28px",
                              height: "28px",
                              borderRadius: "50%",
                              background: "rgba(27, 98, 75, 0.05)"
                            }}
                          >
                            <ChevronDown size={16} />
                          </span>
                        </button>

                        <div
                          style={{
                            height: isOpen ? "auto" : "0px",
                            maxHeight: isOpen ? "300px" : "0px",
                            opacity: isOpen ? 1 : 0,
                            overflow: "hidden",
                            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                          }}
                        >
                          <div style={{ padding: "0 20px 20px", fontSize: "14px", color: "var(--muted)", lineHeight: 1.6, borderTop: "1px dashed rgba(211, 201, 189, 0.4)", paddingTop: "16px" }}>
                            {faq.a}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "60px 20px", background: "var(--panel)", borderRadius: "16px", border: "1px solid rgba(211, 201, 189, 0.5)" }}>
            <HelpCircle size={48} style={{ color: "var(--muted)", marginBottom: "16px" }} />
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink)", marginBottom: "8px" }}>No answers found</h3>
            <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "20px" }}>
              We couldn't find any results matching "{searchQuery}". Try different keywords.
            </p>
            <button
              onClick={() => setSearchQuery("")}
              style={{
                background: "var(--brand-color)",
                color: "#fff",
                border: "none",
                padding: "10px 24px",
                borderRadius: "20px",
                fontWeight: 700,
                fontSize: "14px",
                cursor: "pointer"
              }}
            >
              Clear Search
            </button>
          </div>
        )}

        {/* Business Ownership */}
        <div style={{ marginTop: "40px", textAlign: "center", padding: "30px", background: "var(--panel)", borderRadius: "16px", border: "1px solid rgba(211, 201, 189, 0.5)" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-display)", fontStyle: "italic", marginBottom: "8px" }}>Business Ownership</h2>
          <p style={{ color: "var(--muted)", fontSize: "15px", margin: 0 }}>
            Pubesto is owned and operated by <strong>GO HYPE MEDIA</strong>.
          </p>
        </div>

        {/* Footer help notice */}
        <div style={{ marginTop: "40px", textAlign: "center", padding: "24px", background: "rgba(27, 98, 75, 0.03)", borderRadius: "16px", border: "1px solid rgba(27, 98, 75, 0.08)" }}>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--ink)", fontWeight: 600 }}>
            Still have questions? We're here to help.
          </p>
          <p style={{ margin: "6px 0 16px", fontSize: "13px", color: "var(--muted)" }}>
            Reach out to our customer support team Monday through Saturday.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "center" }}>
            <Link
              href="/contact"
              style={{
                background: "var(--brand-color)",
                color: "#fff",
                padding: "10px 24px",
                borderRadius: "20px",
                fontSize: "13px",
                fontWeight: 700,
                textDecoration: "none",
                transition: "opacity 0.2s"
              }}
            >
              Contact Us
            </Link>
            <a
              href="mailto:support@pubesto.com"
              style={{
                background: "transparent",
                color: "var(--brand-color)",
                border: "1px solid var(--brand-color)",
                padding: "9px 24px",
                borderRadius: "20px",
                fontSize: "13px",
                fontWeight: 700,
                textDecoration: "none",
                transition: "background 0.2s"
              }}
            >
              Email Support
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
