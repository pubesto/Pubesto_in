"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ChevronLeft, Loader2, ShoppingBag } from "lucide-react"

import "rrweb-player/dist/style.css"

import type { RecordingDetail } from "@/lib/server/analytics/recordings"

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(seconds / 60)
  return minutes ? `${minutes}m ${String(seconds % 60).padStart(2, "0")}s` : `${seconds}s`
}

export function RecordingPlayer({ detail }: { detail: RecordingDetail }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let destroyed = false
    let player: { $destroy?: () => void } | null = null

    async function boot() {
      try {
        const [{ default: Player }, response] = await Promise.all([
          import("rrweb-player"),
          fetch(`/api/recordings/${detail.id}`, { credentials: "same-origin" }),
        ])
        if (!response.ok) {
          throw new Error(response.status === 404 ? "This recording has no playable events yet." : "The recording could not be loaded.")
        }
        const payload = (await response.json()) as { events: unknown[] }
        if (destroyed || !containerRef.current) return
        if (payload.events.length < 2) {
          throw new Error("This recording is too short to replay.")
        }

        containerRef.current.innerHTML = ""
        const width = Math.min(containerRef.current.clientWidth || 960, 1200)
        const height = Math.round(width * (detail.device === "mobile" ? 1.1 : 0.62))

        player = new Player({
          target: containerRef.current,
          props: {
            events: payload.events as never,
            width,
            height,
            autoPlay: true,
            showController: true,
            speedOption: [1, 2, 4, 8],
            skipInactive: true,
          },
        }) as unknown as { $destroy?: () => void }
        setStatus("ready")
      } catch (error) {
        if (destroyed) return
        setStatus("error")
        setMessage(error instanceof Error ? error.message : "The recording could not be loaded.")
      }
    }

    void boot()

    return () => {
      destroyed = true
      player?.$destroy?.()
    }
  }, [detail.id, detail.device])

  return (
    <main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/analytics/recordings"
            aria-label="Back to recordings"
            className="rounded-lg bg-black/[0.06] p-2 text-black/65 hover:bg-black/10"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              Session replay
              {status === "loading" ? <Loader2 className="size-4 animate-spin text-black/40" /> : null}
            </h1>
            <p className="text-xs text-black/55">
              {new Date(detail.startedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
              {formatDuration(detail.durationMs)} · {detail.pageCount} {detail.pageCount === 1 ? "page" : "pages"}
            </p>
          </div>
        </div>
        {detail.converted && detail.orderId ? (
          <Link
            href={`/dashboard/orders/${detail.orderId}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700"
          >
            <ShoppingBag className="size-3.5" />
            View the order
          </Link>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-xl border border-black/10 bg-white p-3 shadow-sm">
          <div ref={containerRef} className="min-h-[360px] w-full overflow-auto [&_.rr-player]:mx-auto" />
          {status === "error" ? (
            <p className="py-10 text-center text-sm text-black/60">{message}</p>
          ) : null}
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
            <h2 className="w-fit border-b border-dotted border-black/55 text-sm font-medium text-black/75">Visit details</h2>
            <dl className="mt-3 space-y-2 text-xs">
              {[
                ["Visitor", detail.customerName ?? "Guest"],
                ["Device", `${detail.device}${detail.country ? ` · ${detail.country}` : ""}`],
                ["Traffic source", detail.channelLabel + (detail.source ? ` (${detail.source})` : "")],
                ["Referrer", detail.landingReferrer ?? "None"],
                ["Outcome", detail.converted ? "Placed an order" : "Browsed only"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-black/50">{label}</dt>
                  <dd className="truncate text-right capitalize text-black/80" title={value}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
            <h2 className="w-fit border-b border-dotted border-black/55 text-sm font-medium text-black/75">Pages visited</h2>
            <ol className="mt-3 space-y-1.5 text-xs text-black/75">
              {detail.pagePaths.map((path, index) => (
                <li key={`${path}-${index}`} className="flex gap-2">
                  <span className="w-4 shrink-0 text-black/40">{index + 1}.</span>
                  <span className="truncate" title={path}>
                    {path}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
            <h2 className="w-fit border-b border-dotted border-black/55 text-sm font-medium text-black/75">Browser</h2>
            <p className="mt-3 break-words text-xs text-black/60">{detail.userAgent ?? "Unknown"}</p>
          </section>
        </aside>
      </div>
    </main>
  )
}
