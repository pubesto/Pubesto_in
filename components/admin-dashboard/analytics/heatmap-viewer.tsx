"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { Loader2, MousePointerClick, Move, ScrollText } from "lucide-react"

import { fetchHeatmapAction, listHeatmapPagesAction } from "@/app/actions/analytics"
import {
  DateRangePicker,
  type AnalyticsRangeSelection,
} from "@/components/admin-dashboard/analytics/date-range-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { HeatmapData, HeatmapPageOption } from "@/lib/server/dal/heatmaps"

type Mode = "clicks" | "moves" | "scroll"
type Device = "all" | "desktop" | "mobile" | "tablet"

const FRAME_WIDTHS: Record<Device, number> = { all: 1280, desktop: 1280, tablet: 820, mobile: 390 }

function drawHeat(
  canvas: HTMLCanvasElement,
  points: Array<{ fx: number; fy: number; weight: number }>,
  width: number,
  height: number,
  radius: number,
) {
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) return
  context.clearRect(0, 0, width, height)
  if (!points.length) return

  const maxWeight = Math.max(...points.map((point) => point.weight), 1)
  context.globalCompositeOperation = "lighter"
  for (const point of points) {
    const x = point.fx * width
    const y = point.fy * height
    const intensity = Math.min(1, 0.25 + (point.weight / maxWeight) * 0.75)
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, `rgba(255, 70, 40, ${0.55 * intensity})`)
    gradient.addColorStop(0.45, `rgba(255, 170, 0, ${0.3 * intensity})`)
    gradient.addColorStop(1, "rgba(0, 120, 255, 0)")
    context.fillStyle = gradient
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fill()
  }
  context.globalCompositeOperation = "source-over"
}

export function HeatmapViewer({
  initialPages,
  initialData,
}: {
  initialPages: HeatmapPageOption[]
  initialData: HeatmapData | null
}) {
  const [pages, setPages] = useState(initialPages)
  const [data, setData] = useState(initialData)
  const [path, setPath] = useState(initialData?.path ?? initialPages[0]?.path ?? "/")
  const [device, setDevice] = useState<Device>("all")
  const [mode, setMode] = useState<Mode>("clicks")
  const [range, setRange] = useState<AnalyticsRangeSelection>({ preset: "Last 30 days" })
  const [rangeLabel, setRangeLabel] = useState("Last 30 days")
  const [frameHeight, setFrameHeight] = useState(initialData?.typicalDocumentHeight ?? 2400)
  const [containerWidth, setContainerWidth] = useState(960)
  const [isPending, startTransition] = useTransition()

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const frameWidth = FRAME_WIDTHS[device]
  const scale = Math.min(1, containerWidth / frameWidth)

  const load = useCallback(
    (next: { path: string; device: Device; range: AnalyticsRangeSelection }) => {
      startTransition(async () => {
        const [heatmap, pageList] = await Promise.all([
          fetchHeatmapAction({ path: next.path, device: next.device, ...next.range }),
          listHeatmapPagesAction(next.range),
        ])
        if (heatmap.success) setData(heatmap.data)
        if (pageList.success) setPages(pageList.data)
      })
    },
    [],
  )

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) setContainerWidth(Math.floor(width))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const measureFrame = useCallback(() => {
    const frame = iframeRef.current
    try {
      const height = frame?.contentDocument?.documentElement?.scrollHeight
      if (height && height > 200) setFrameHeight(height)
    } catch {
      // cross-origin: keep the typical height from the data
    }
  }, [])

  const points = useMemo(() => {
    if (!data) return []
    if (mode === "clicks") return data.clicks.map((click) => ({ fx: click.fx, fy: click.fy, weight: 1 }))
    if (mode === "moves") return data.moves
    return []
  }, [data, mode])

  useEffect(() => {
    if (!canvasRef.current) return
    drawHeat(canvasRef.current, points, frameWidth, frameHeight, mode === "clicks" ? 22 : 34)
  }, [points, frameWidth, frameHeight, mode])

  function update(partial: Partial<{ path: string; device: Device; range: AnalyticsRangeSelection }>) {
    const next = { path, device, range, ...partial }
    if (partial.path !== undefined) setPath(partial.path)
    if (partial.device !== undefined) setDevice(partial.device)
    if (partial.range !== undefined) setRange(partial.range)
    load(next)
  }

  return (
    <main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <MousePointerClick className="size-4" />
            Heatmaps
            {isPending ? <Loader2 className="size-4 animate-spin text-black/40" /> : null}
          </h1>
          <p className="mt-0.5 text-xs text-black/55">
            Where visitors click, move and how far they scroll, drawn over the live page.
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
          label={rangeLabel}
          onChange={(selection, label) => {
            setRangeLabel(label)
            update({ range: selection })
          }}
        />
        <Select value={path} onValueChange={(value) => update({ path: value })}>
          <SelectTrigger aria-label="Page" className="h-8 w-64 border-black/15 bg-white text-xs shadow-sm">
            <SelectValue placeholder="Choose a page" />
          </SelectTrigger>
          <SelectContent position="popper">
            {(pages.some((page) => page.path === path) ? pages : [{ path, views: 0 }, ...pages]).map((page) => (
              <SelectItem key={page.path} value={page.path}>
                {page.path} {page.views ? `· ${page.views} views` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={device} onValueChange={(value) => update({ device: value as Device })}>
          <SelectTrigger aria-label="Device" className="h-8 w-32 border-black/15 bg-white text-xs shadow-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">All devices</SelectItem>
            <SelectItem value="desktop">Desktop</SelectItem>
            <SelectItem value="tablet">Tablet</SelectItem>
            <SelectItem value="mobile">Mobile</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto inline-flex rounded-lg border border-black/15 bg-white p-0.5 text-xs shadow-sm">
          {(
            [
              ["clicks", "Clicks", MousePointerClick],
              ["moves", "Movement", Move],
              ["scroll", "Scroll depth", ScrollText],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              aria-pressed={mode === value}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 ${
                mode === value ? "bg-black text-white" : "text-black/70 hover:bg-black/5"
              }`}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-xl border border-black/10 bg-white p-3 shadow-sm">
          <div ref={containerRef} className="relative w-full overflow-hidden rounded-lg border border-black/10 bg-[#fafafa]">
            <div
              className="relative origin-top-left"
              style={{ width: frameWidth, height: frameHeight, transform: `scale(${scale})`, marginBottom: -(frameHeight * (1 - scale)) }}
            >
              <iframe
                ref={iframeRef}
                title={`Preview of ${path}`}
                src={`${path}${path.includes("?") ? "&" : "?"}heatmap=1`}
                width={frameWidth}
                height={frameHeight}
                onLoad={measureFrame}
                className="block border-0 bg-white"
                style={{ width: frameWidth, height: frameHeight, pointerEvents: "none" }}
                sandbox="allow-same-origin allow-scripts"
              />
              <canvas
                ref={canvasRef}
                className="pointer-events-none absolute left-0 top-0"
                style={{ width: frameWidth, height: frameHeight, opacity: mode === "scroll" ? 0 : 0.9 }}
              />
              {mode === "scroll" && data ? (
                <div className="pointer-events-none absolute inset-0">
                  {data.scrollDepth.map((band, index) => (
                    <div
                      key={band.band}
                      className="absolute left-0 right-0 flex items-start justify-end"
                      style={{
                        top: `${index * 10}%`,
                        height: "10%",
                        background: `rgba(255, ${Math.round(255 - band.share * 2.2)}, 40, ${0.1 + (band.share / 100) * 0.4})`,
                        borderTop: "1px dashed rgba(0,0,0,0.15)",
                      }}
                    >
                      <span className="m-2 rounded bg-black/75 px-2 py-0.5 text-[11px] font-medium text-white">
                        {band.share}% reached {band.band}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <p className="mt-2 text-[11px] text-black/45">
            Preview at {frameWidth}px wide, scaled to fit. Positions are mapped proportionally, so elements that move between screen sizes can shift slightly.
          </p>
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
            <h2 className="w-fit border-b border-dotted border-black/55 text-sm font-medium text-black/75">This page</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-center">
              {[
                ["Page views", data?.pageViews ?? 0],
                ["Sessions", data?.sessions ?? 0],
                ["Clicks", data?.clicks.length ?? 0],
                ["Move samples", data?.moves.length ?? 0],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-black/[0.03] p-3">
                  <dd className="text-xl font-semibold text-black/80">{value}</dd>
                  <dt className="text-[11px] text-black/55">{label}</dt>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
            <h2 className="w-fit border-b border-dotted border-black/55 text-sm font-medium text-black/75">Most clicked elements</h2>
            {data?.topTargets.length ? (
              <ol className="mt-3 space-y-2 text-xs">
                {data.topTargets.map((target) => (
                  <li key={target.target} className="flex justify-between gap-3">
                    <span className="truncate text-black/75" title={target.target}>
                      {target.target}
                    </span>
                    <span className="shrink-0 font-medium">{target.clicks}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-xs text-black/55">No clicks recorded for this page yet.</p>
            )}
          </section>

          <section className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
            <h2 className="w-fit border-b border-dotted border-black/55 text-sm font-medium text-black/75">Scroll depth</h2>
            <div className="mt-3 space-y-1.5">
              {(data?.scrollDepth ?? []).map((band) => (
                <div key={band.band} className="flex items-center gap-2 text-xs">
                  <span className="w-10 text-black/55">{band.band}%</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-sm bg-black/[0.05]">
                    <div className="h-full bg-[#75c5e5]" style={{ width: `${band.share}%` }} />
                  </div>
                  <span className="w-10 text-right font-medium">{band.share}%</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  )
}
