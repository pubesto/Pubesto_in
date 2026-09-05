"use client";

import React from 'react';
import Link from 'next/link';
import { Shield, FileText, Truck, RotateCcw } from 'lucide-react';

const policyNav = [
  { label: 'Privacy Policy', href: '/privacy-policy', icon: Shield },
  { label: 'Terms of Service', href: '/terms-of-service', icon: FileText },
  { label: 'Refund Policy', href: '/refund-return-policy', icon: RotateCcw },
  { label: 'Shipping Policy', href: '/shipping-policy', icon: Truck },
];

export default function PolicyLayout({ title, children }) {
  return (
    <main className="policy-page">
      <div className="policy-accent-glow" />
      <div className="policy-accent-glow-2" />
      <div className="policy-container">
        {/* Header */}
        <div className="policy-header">
          <div className="policy-eyebrow-badge">
            <Shield size={14} />
            Legal Information
          </div>
          <h1>{title}</h1>
          <p className="policy-subtitle">
            Last updated: May 2026 &middot; Pubesto
          </p>
          <div className="policy-divider" />
        </div>

        {/* Body */}
        <div className="policy-body">
          {children}
        </div>

        {/* Footer */}
        <div className="policy-footer">
          <div className="policy-footer-card">
            <p className="policy-footer-title">Have questions about this policy?</p>
            <p className="policy-footer-text">Our support team is available Monday through Saturday to assist you.</p>
            <div className="policy-footer-actions">
              <Link href="/contact" className="policy-footer-btn primary">Contact Us</Link>
              <a href="mailto:support@pubesto.com" className="policy-footer-btn outline">Email Support</a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
