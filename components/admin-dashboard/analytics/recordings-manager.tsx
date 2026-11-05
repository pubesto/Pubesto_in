"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Loader2, MonitorPlay, Play, ShoppingBag } from "lucide-react"

import { listRecordingsAction } from "@/app/actions/analytics"
import {
  DateRangePicker,
  type AnalyticsRangeSelection,
} from "@/components/admin-dashboard/analytics/date-range-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { RecordingList } from "@/lib/server/analytics/recordings"

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(seconds / 60)
  return minutes ? `${minutes}m ${String(seconds % 60).padStart(2, "0")}s` : `${seconds}s`
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  })
}

type Filters = {
  range: AnalyticsRangeSelection
  rangeLabel: string
  device: "all" | "desktop" | "mobile" | "tablet"
  path: string
  converted: boolean
  page: number
}

export function RecordingsManager({ initialData }: { initialData: RecordingList }) {
  const [data, setData] = useState(initialData)
  const [filters, setFilters] = useState<Filters>({
    range: { preset: "Last 30 days" },
    rangeLabel: "Last 30 days",
    device: "all",
    path: "",
    converted: false,
    page: 1,
  })
  const [isPending, startTransition] = useTransition()

  function load(next: Filters) {
    setFilters(next)
    startTransition(async () => {
      const result = await listRecordingsAction({
        ...next.range,
        device: next.device === "all" ? undefined : next.device,
        path: next.path || undefined,
        converted: next.converted || undefined,
        page: next.page,
        pageSize: data.pageSize,
      })
      if (result.success) setData(result.data)
    })
  }

  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize))

  return (
    <main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <MonitorPlay className="size-4" />
            Session recordings
            {isPending ? <Loader2 className="size-4 animate-spin text-black/40" /> : null}
          </h1>
          <p className="mt-0.5 text-xs text-black/55">
            Anonymised replays of real visits. Typed text is masked before it leaves the browser.
          </p>
        </div>
        <Link
          href="/dashboard/analytics"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-black/[0.06] px-3 text-xs font-medium hover:bg-black/10"
        >
          Back to analytics
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <DateRangePicker
          label={filters.rangeLabel}
          onChange={(range, label) => load({ ...filters, range, rangeLabel: label, page: 1 })}
        />
        <Select value={filters.device} onValueChange={(device) => load({ ...filters, device: device as Filters["device"], page: 1 })}>
          <SelectTrigger aria-label="Device" className="h-8 w-32 border-black/15 bg-white text-xs shadow-sm">
            <SelectValue placeholder="All devices" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">All devices</SelectItem>
            <SelectItem value="desktop">Desktop</SelectItem>
            <SelectItem value="mobile">Mobile</SelectItem>
            <SelectItem value="tablet">Tablet</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.path || "__all"} onValueChange={(path) => load({ ...filters, path: path === "__all" ? "" : path, page: 1 })}>
          <SelectTrigger aria-label="Page" className="h-8 w-56 border-black/15 bg-white text-xs shadow-sm">
            <SelectValue placeholder="Any page" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="__all">Any page</SelectItem>
            {data.pathOptions.map((path) => (
              <SelectItem key={path} value={path}>
                {path}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-black/15 bg-white px-3 text-xs font-medium shadow-sm">
          <input
            type="checkbox"
            checked={filters.converted}
            onChange={(event) => load({ ...filters, converted: event.target.checked, page: 1 })}
            className="accent-black"
          />
          Ended in an order
        </label>
      </div>

      <section className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead className="bg-black/[0.025] text-xs text-black/65">
              <tr>
                <th className="border-b border-black/10 px-3 py-2.5 font-medium">Started</th>
                <th className="border-b border-black/10 px-3 py-2.5 font-medium">Duration</th>
                <th className="border-b border-black/10 px-3 py-2.5 font-medium">Device</th>
                <th className="border-b border-black/10 px-3 py-2.5 font-medium">Source</th>
                <th className="border-b border-black/10 px-3 py-2.5 font-medium">Pages</th>
                <th className="border-b border-black/10 px-3 py-2.5 font-medium">Visitor</th>
                <th className="border-b border-black/10 px-3 py-2.5 font-medium">Outcome</th>
                <th className="border-b border-black/10 px-3 py-2.5 font-medium text-right">Replay</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="hover:bg-black/[0.02]">
                  <td className="border-b border-black/10 px-3 py-2 text-black/80">{formatDate(item.startedAt)}</td>
                  <td className="border-b border-black/10 px-3 py-2 tabular-nums text-black/80">{formatDuration(item.durationMs)}</td>
                  <td className="border-b border-black/10 px-3 py-2 capitalize text-black/80">
                    {item.device}
                    {item.country ? <span className="ml-1 text-black/45">· {item.country}</span> : null}
                  </td>
                  <td className="border-b border-black/10 px-3 py-2 text-black/80">{item.channelLabel}</td>
                  <td className="border-b border-black/10 px-3 py-2 text-black/80">
                    <span className="font-medium">{item.pageCount}</span>
                    <span className="ml-2 truncate text-xs text-black/50" title={item.pagePaths.join(" → ")}>
                      {item.firstPath}
                      {item.pageCount > 1 ? ` → …` : ""}
                    </span>
                  </td>
                  <td className="border-b border-black/10 px-3 py-2 text-black/80">{item.customerName ?? "Guest"}</td>
                  <td className="border-b border-black/10 px-3 py-2">
                    {item.converted ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                        <ShoppingBag className="size-3" />
                        Ordered
                      </span>
                    ) : (
                      <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-xs text-black/60">Browsed</span>
                    )}
                  </td>
                  <td className="border-b border-black/10 px-3 py-2 text-right">
                    <Link
                      href={`/dashboard/analytics/recordings/${item.id}`}
                      className="inline-flex h-7 items-center gap-1 rounded-lg bg-black px-2.5 text-xs font-medium text-white hover:bg-black/80"
                    >
                      <Play className="size-3" />
                      Play
                    </Link>
                  </td>
                </tr>
              ))}
              {!data.items.length ? (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-sm text-black/55">
                    No recordings match these filters yet. Recordings appear a few seconds after a visit starts.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-1 border-t border-black/10 px-3 py-2 text-xs text-black/60">
          <button
            type="button"
            aria-label="Previous page"
            disabled={filters.page <= 1 || isPending}
            onClick={() => load({ ...filters, page: filters.page - 1 })}
            className="rounded-md bg-black/5 p-1 hover:bg-black/10 disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next page"
            disabled={filters.page >= pageCount || isPending}
            onClick={() => load({ ...filters, page: filters.page + 1 })}
            className="rounded-md bg-black/5 p-1 hover:bg-black/10 disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
          <span className="ml-1">
            Page {filters.page} of {pageCount} · {data.total} {data.total === 1 ? "recording" : "recordings"}
          </span>
        </div>
      </section>
    </main>
  )
}
