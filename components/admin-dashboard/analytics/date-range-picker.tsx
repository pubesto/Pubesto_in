"use client"

import { useState } from "react"
import type { DateRange } from "react-day-picker"
import { CalendarDays, ChevronDown } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export type AnalyticsRangeSelection = {
  preset?: string
  from?: string
  to?: string
  days?: number
}

export const RANGE_PRESETS = [
  "Today",
  "Yesterday",
  "Last 7 days",
  "Last 30 days",
  "Last 90 days",
  "Quarter to date",
] as const

function formatRange(range: DateRange | undefined) {
  if (!range?.from) return "Custom range"
  const formatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" })
  if (!range.to) return formatter.format(range.from)
  return `${formatter.format(range.from)} – ${formatter.format(range.to)}`
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

/**
 * Shopify-style date range control shared by every analytics page.
 */
export function DateRangePicker({
  label,
  onChange,
}: {
  label: string
  onChange: (selection: AnalyticsRangeSelection, label: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange | undefined>()

  function choosePreset(preset: string) {
    setOpen(false)
    setDateRange(undefined)
    onChange({ preset }, preset)
  }

  function applyCustom() {
    if (!dateRange?.from) return
    setOpen(false)
    const from = toIsoDate(dateRange.from)
    const to = toIsoDate(dateRange.to ?? dateRange.from)
    onChange({ from, to }, formatRange(dateRange))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-black/15 bg-white px-3 text-xs font-medium text-black/80 shadow-sm transition-colors hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25"
        >
          <CalendarDays className="size-3.5" />
          {label}
          <ChevronDown className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="z-30 flex w-[min(640px,calc(100vw-2rem))] overflow-hidden rounded-xl border-black/15 p-0 shadow-xl"
      >
        <div className="w-40 shrink-0 border-r border-black/10 bg-[#fafafa] p-2">
          {RANGE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => choosePreset(preset)}
              className={`w-full rounded-md px-2 py-2 text-left text-xs transition-colors hover:bg-black/5 ${
                preset === label ? "bg-black/10 font-medium" : "text-black/70"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-1 p-4">
          <p className="text-xs font-medium text-black/70">Custom range</p>
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={setDateRange}
            numberOfMonths={2}
            className="mt-3 max-w-full"
          />
          <div className="mt-4 flex justify-end gap-2 border-t border-black/10 pt-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-black/20 px-3 py-1.5 text-xs hover:bg-black/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applyCustom}
              disabled={!dateRange?.from}
              className="rounded-md bg-black px-3 py-1.5 text-xs text-white hover:bg-black/80 disabled:opacity-40"
            >
              Apply
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
