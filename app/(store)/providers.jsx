'use client';

import { StoreProvider } from "@/components/StoreContext";

export function Providers({ children, products = [], categories = [], heroSlides = [] }) {
  return (
    <StoreProvider categories={categories} products={products} heroSlides={heroSlides}>
      {children}
    </StoreProvider>
  );
}
