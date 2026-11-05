"use client"

export type RazorpaySuccessResponse = {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

export type RazorpayErrorResponse = {
  error: {
    code: string
    description: string
    source: string
    step: string
    reason: string
    metadata: {
      order_id?: string
      payment_id?: string
    }
  }
}

export interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  name: string
  description?: string
  image?: string
  order_id: string
  prefill?: {
    name?: string
    email?: string
    contact?: string
    method?: "upi" | "card" | "netbanking"
  }
  notes?: Record<string, string>
  theme?: {
    color?: string
    backdrop_color?: string
    hide_topbar?: boolean
  }
  modal?: {
    backdropclose?: boolean
    escape?: boolean
    handleback?: boolean
    confirm_close?: boolean
    ondismiss?: () => void
  }
  handler?: (response: RazorpaySuccessResponse) => void
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => {
      open: () => void
      on: (event: string, handler: (response: unknown) => void) => void
      close: () => void
    }
  }
}

let scriptLoadingPromise: Promise<boolean> | null = null

/**
 * Dynamically loads the Razorpay Standard Checkout script.
 * Caches the load promise so it only ever loads once.
 */
export function loadRazorpayCheckoutScript(): Promise<boolean> {
  if (typeof window === "undefined") {
    return Promise.resolve(false)
  }

  if (window.Razorpay) {
    return Promise.resolve(true)
  }

  if (scriptLoadingPromise) {
    return scriptLoadingPromise
  }

  scriptLoadingPromise = new Promise((resolve) => {
    // Check if the script tag is already in DOM
    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true))
      existingScript.addEventListener("error", () => resolve(false))
      return
    }

    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => {
      scriptLoadingPromise = null
      resolve(false)
    }
    document.body.appendChild(script)
  })

  return scriptLoadingPromise
}
