"use client"

import { getSessionId, getVisitorId } from "@/lib/analytics-client"

/**
 * Session recording on the storefront, powered by rrweb. Events are buffered
 * and shipped to /api/recordings in small gzip-friendly batches. Inputs are
 * masked so recordings never contain what shoppers type.
 */

type RecordedEvent = { type: number; timestamp: number; data: unknown }

const FLUSH_INTERVAL_MS = 5_000
const MAX_BUFFER_BYTES = 200_000
const MAX_SESSION_MS = 30 * 60 * 1000
const SAMPLE_KEY = "pubesto_rec_sample"

let stopRecording: (() => void) | null = null
let buffer: RecordedEvent[] = []
let bufferBytes = 0
let seq = 0
let flushTimer: ReturnType<typeof setInterval> | null = null
let recordingId: string | null = null
let startedAt = 0
let inFlight: Promise<void> = Promise.resolve()

function sampleRate() {
  const raw = process.env.NEXT_PUBLIC_RECORDING_SAMPLE_RATE
  const value = raw === undefined ? 100 : Number(raw)
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 100
}

function shouldRecord() {
  if (typeof window === "undefined") return false
  if (window.self !== window.top) return false
  if (navigator.doNotTrack === "1") return false
  if (/bot|crawl|spider|slurp|headless/i.test(navigator.userAgent)) return false

  try {
    const stored = sessionStorage.getItem(SAMPLE_KEY)
    if (stored === "1") return true
    if (stored === "0") return false
    const sampled = Math.random() * 100 < sampleRate()
    sessionStorage.setItem(SAMPLE_KEY, sampled ? "1" : "0")
    return sampled
  } catch {
    return sampleRate() >= 100
  }
}

function send(events: RecordedEvent[], keepalive: boolean) {
  if (!events.length || !recordingId) return Promise.resolve()
  const body = JSON.stringify({
    recordingId,
    visitorId: getVisitorId(),
    seq: seq++,
    path: `${window.location.pathname}${window.location.search}`,
    events,
  })

  const request = fetch("/api/recordings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive,
  })
    .then(() => undefined)
    .catch(() => undefined)

  inFlight = inFlight.then(() => request)
  return request
}

function flush(keepalive = false) {
  if (!buffer.length) return
  const events = buffer
  buffer = []
  bufferBytes = 0
  // keepalive requests are capped around 64KB; drop oversized tails rather
  // than block navigation.
  if (keepalive && JSON.stringify(events).length > 60_000) {
    void send(events.slice(0, 50), true)
    return
  }
  void send(events, keepalive)
}

export async function startSessionRecording() {
  if (stopRecording || !shouldRecord()) return

  const { record } = await import("rrweb")

  recordingId = getSessionId()
  startedAt = Date.now()

  const stop = record({
    emit: (event) => {
      buffer.push(event as RecordedEvent)
      bufferBytes += JSON.stringify(event).length
      if (bufferBytes >= MAX_BUFFER_BYTES) flush()
      if (Date.now() - startedAt > MAX_SESSION_MS) stopSessionRecording()
    },
    maskAllInputs: true,
    maskTextClass: "rr-mask",
    blockClass: "rr-block",
    blockSelector: "iframe, [data-rr-block]",
    inlineStylesheet: true,
    recordCanvas: false,
    collectFonts: false,
    checkoutEveryNms: 2 * 60 * 1000,
    sampling: {
      mousemove: 60,
      mouseInteraction: true,
      scroll: 150,
      media: 800,
      input: "last",
    },
  })

  stopRecording = stop ?? null
  flushTimer = setInterval(() => flush(), FLUSH_INTERVAL_MS)

  const onHide = () => {
    if (document.visibilityState === "hidden") flush(true)
  }
  window.addEventListener("pagehide", () => flush(true))
  document.addEventListener("visibilitychange", onHide)
}

export function stopSessionRecording() {
  if (stopRecording) {
    stopRecording()
    stopRecording = null
  }
  if (flushTimer) {
    clearInterval(flushTimer)
    flushTimer = null
  }
  flush(true)
}
