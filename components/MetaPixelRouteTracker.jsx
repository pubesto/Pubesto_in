"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function MetaPixelRouteTracker() {
  const pathname = usePathname();
  const isInitialPageView = useRef(true);

  useEffect(() => {
    if (isInitialPageView.current) {
      isInitialPageView.current = false;
      return;
    }

    if (typeof window.fbq === "function") {
      window.fbq("track", "PageView");
    }
  }, [pathname]);

  return null;
}
