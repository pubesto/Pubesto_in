"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackPixel } from "../lib/meta-pixel";

// Sends PageView on first load and on every client-side navigation, to both the
// browser pixel and the Conversions API (the base script in layout.jsx only inits).
export default function MetaPixelRouteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    trackPixel("PageView");
  }, [pathname]);

  return null;
}
