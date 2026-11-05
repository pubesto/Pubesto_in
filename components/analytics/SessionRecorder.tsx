"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

import { startSessionRecording } from "@/lib/recording-client"

/**
 * Renders nothing. Starts the rrweb session recording on storefront pages
 * (never on the dashboard) after the page has become interactive.
 */
export function SessionRecorder() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname || pathname.startsWith("/dashboard") || pathname.startsWith("/api")) {
      return
    }
    const idle =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(() => void startSessionRecording(), { timeout: 2_000 })
        : window.setTimeout(() => void startSessionRecording(), 800)

    return () => {
      if (typeof window.cancelIdleCallback === "function" && typeof idle === "number") {
        window.cancelIdleCallback(idle)
      } else {
        window.clearTimeout(idle as number)
      }
    }
  }, [pathname])

  return null
}
