'use client';

import { StoreProvider } from "../components/StoreContext";
import { categories, products } from "../lib/data";

export function Providers({ children }) {
  return (
    <StoreProvider categories={categories} products={products}>
      {children}
    </StoreProvider>
  );
}
