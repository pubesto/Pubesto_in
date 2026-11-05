"use client"

import { Printer } from "lucide-react"

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 text-xs font-medium hover:bg-black/[0.03]"
    >
      <Printer className="size-3.5" />
      Print
    </button>
  )
}
