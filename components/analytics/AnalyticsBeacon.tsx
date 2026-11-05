"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

import { trackPageView } from "@/lib/analytics-client"

/**
 * Renders nothing. Records a page view on every client-side navigation and
 * skips the admin dashboard so staff activity never pollutes store analytics.
 */
export function AnalyticsBeacon() {
  const pathname = usePathname()
  const lastTracked = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname || pathname.startsWith("/dashboard") || pathname.startsWith("/api")) {
      return
    }
    const fullPath = `${pathname}${window.location.search}`
    if (lastTracked.current === fullPath) return
    lastTracked.current = fullPath
    trackPageView(fullPath)
  }, [pathname])

  return null
}
