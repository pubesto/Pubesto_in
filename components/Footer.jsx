"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { FacebookIcon, InstagramIcon } from "./Icons";
import { Logo, useVisibleCategories } from "./Header";

const helpLinks = [
  { label: "Track order", href: "/returns/track" },
  { label: "Request a return", href: "/returns" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact us", href: "/contact" },
  { label: "About Pubesto", href: "/about" },
];

const policyLinks = [
  { label: "Shipping policy", href: "/shipping-policy" },
  { label: "Refund & return policy", href: "/refund-return-policy" },
  { label: "Privacy policy", href: "/privacy-policy" },
  { label: "Terms of service", href: "/terms-of-service" },
];

const socialLinks = [
  { label: "Instagram", href: "https://www.instagram.com/pubesto_official/", Icon: InstagramIcon },
  { label: "Facebook", href: "https://www.facebook.com/", Icon: FacebookIcon },
];

export default function Footer() {
  const categories = useVisibleCategories();
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");

  function handleSubscribe(event) {
    event.preventDefault();
    const value = email.trim();
    setNotice(value ? `Thanks! Offers will be sent to ${value}.` : "Enter an email address to subscribe.");
    if (value) setEmail("");
  }

  return (
    <footer id="footer" className="pb-footer">
      <div className="pb-container">
        <div className="pb-footer-top">
          <div className="pb-footer-about">
            <Link href="/" aria-label="Pubesto home" prefetch={false}>
              <Logo tone="light" tagline />
            </Link>
            <p>
              Practical picks, not clutter. Pubesto curates cooling gadgets, bottles, lunch storage and everyday
              essentials for Indian homes.
            </p>
            <form className="pb-newsletter" onSubmit={handleSubscribe}>
              <input
                type="email"
                placeholder="Your email for deals"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Email address"
              />
              <button type="submit">Subscribe</button>
            </form>
            {notice ? <p className="pb-footer-note">{notice}</p> : null}
            <div className="pb-socials" style={{ marginTop: 20 }}>
              {socialLinks.map(({ label, href, Icon }) => (
                <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label}>
                  <Icon size={19} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3>Shop</h3>
            <ul className="pb-footer-links">
              <li><Link href="/shop" prefetch={false}>All products</Link></li>
              {categories.slice(0, 6).map((category) => (
                <li key={category.name}>
                  <Link href={`/shop?category=${encodeURIComponent(category.name)}`} prefetch={false}>
                    {category.label || category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3>Help</h3>
            <ul className="pb-footer-links">
              {helpLinks.map((link) => (
                <li key={link.href}><Link href={link.href} prefetch={false}>{link.label}</Link></li>
              ))}
            </ul>
            <h3 style={{ marginTop: 28 }}>Policies</h3>
            <ul className="pb-footer-links">
              {policyLinks.map((link) => (
                <li key={link.href}><Link href={link.href} prefetch={false}>{link.label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h3>Contact</h3>
            <ul className="pb-footer-links">
              <li><a href="mailto:support@pubesto.com"><Mail size={15} /> support@pubesto.com</a></li>
              <li><a href="tel:+917056063693"><Phone size={15} /> +91 70560 63693</a></li>
              <li><span style={{ display: "inline-flex", gap: 8 }}><Clock size={15} /> Mon – Sat, 10AM – 7PM</span></li>
              <li><span style={{ display: "inline-flex", gap: 8 }}><MapPin size={15} style={{ flexShrink: 0, marginTop: 2 }} /> D-6/1, Okhla Phase 2, New Delhi 110020</span></li>
            </ul>
          </div>
        </div>

        <div className="pb-footer-bottom">
          <span>© {new Date().getFullYear()} Pubesto · Operated by GO HYPE MEDIA. All rights reserved.</span>
          <div className="pb-pay-logos" aria-label="Accepted payments">
            <span><img src="/images/payments/upi.svg" alt="UPI" /></span>
            <span><img src="/images/payments/gpay.svg" alt="Google Pay" /></span>
            <span><img src="/images/payments/mastercard.svg" alt="Mastercard" /></span>
          </div>
        </div>
      </div>
      <div className="pb-footer-word" aria-hidden="true">pubesto</div>
    </footer>
  );
}
