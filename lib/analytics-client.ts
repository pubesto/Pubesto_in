"use client"

/**
 * Lightweight first-party behaviour tracking. Nothing is rendered; events are
 * queued and flushed to /api/track with sendBeacon so navigation is never
 * delayed. All storage access is guarded because private windows and strict
 * privacy settings can throw.
 *
 * Besides page views and commerce events it collects the raw material for
 * heatmaps: clicks (document coordinates), scroll depth per page and a coarse
 * mouse-movement grid, each sent once per page visit.
 */

export type ClientEventType =
  | "PAGE_VIEW"
  | "PRODUCT_VIEW"
  | "ADD_TO_CART"
  | "BEGIN_CHECKOUT"
  | "PURCHASE"
  | "SEARCH"
  | "CLICK"
  | "SCROLL"
  | "MOVE"
  | "CUSTOM"

type QueuedEvent = {
  type: ClientEventType
  path: string
  name?: string
  payload?: Record<string, unknown>
  referrer?: string
  ts: number
}

const VISITOR_KEY = "pubesto_vid"
const SESSION_KEY = "pubesto_sid"
const SESSION_SEEN_KEY = "pubesto_sid_seen"
const SESSION_IDLE_MS = 30 * 60 * 1000
const FLUSH_DELAY_MS = 2_500
const MOVE_CELL_PX = 40

let queue: QueuedEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let listenersBound = false
let heatmapBound = false

// Per-page heatmap accumulators.
let currentPath = ""
let maxScrollDepth = 0
let moveCells = new Map<string, number>()
let lastMoveSample = 0

function randomId() {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID().replace(/-/g, "")
    }
  } catch {
    // fall through
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`
}

function read(storage: Storage | undefined, key: string) {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function write(storage: Storage | undefined, key: string, value: string) {
  try {
    storage?.setItem(key, value)
  } catch {
    // ignore
  }
}

function localStore() {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined
  } catch {
    return undefined
  }
}

function sessionStore() {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : undefined
  } catch {
    return undefined
  }
}

/** True inside the dashboard heatmap preview iframe; nothing is tracked there. */
export function isEmbedded() {
  try {
    return typeof window !== "undefined" && window.self !== window.top
  } catch {
    return true
  }
}

export function getVisitorId() {
  const store = localStore()
  let id = read(store, VISITOR_KEY)
  if (!id) {
    id = randomId()
    write(store, VISITOR_KEY, id)
  }
  return id
}

export function getSessionId() {
  const store = sessionStore()
  const now = Date.now()
  let id = read(store, SESSION_KEY)
  const seen = Number(read(store, SESSION_SEEN_KEY) ?? 0)
  if (!id || !seen || now - seen > SESSION_IDLE_MS) {
    id = randomId()
    write(store, SESSION_KEY, id)
  }
  write(store, SESSION_SEEN_KEY, String(now))
  return id
}

function send(events: QueuedEvent[]) {
  if (!events.length || typeof window === "undefined") return
  const body = JSON.stringify({
    sessionId: getSessionId(),
    visitorId: getVisitorId(),
    events,
  })

  try {
    if (navigator.sendBeacon && body.length < 60_000 && navigator.sendBeacon("/api/track", body)) {
      return
    }
  } catch {
    // fall back to fetch
  }

  void fetch("/api/track", {
    method: "POST",
    body,
    keepalive: body.length < 60_000,
    headers: { "Content-Type": "application/json" },
  }).catch(() => {})
}

export function flushAnalytics() {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  const batch = queue
  queue = []
  send(batch)
}

function documentMetrics() {
  const doc = document.documentElement
  return {
    vw: window.innerWidth,
    vh: window.innerHeight,
    dw: Math.max(doc.scrollWidth, doc.clientWidth),
    dh: Math.max(doc.scrollHeight, doc.clientHeight),
  }
}

function shortSelector(target: EventTarget | null): string {
  const element = target instanceof Element ? target.closest("a, button, [role=button], input, select, textarea, summary, label, img, li, h1, h2, h3, p, span, div") : null
  if (!element) return ""
  const tag = element.tagName.toLowerCase()
  const id = element.id ? `#${element.id}` : ""
  const text = (element.getAttribute("aria-label") || element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60)
  const href = element instanceof HTMLAnchorElement ? element.getAttribute("href") ?? "" : ""
  return `${tag}${id}${href ? `[${href.slice(0, 80)}]` : ""}${text ? ` "${text}"` : ""}`.slice(0, 200)
}

function flushPageHeatmap() {
  if (!currentPath) return
  const metrics = documentMetrics()

  if (maxScrollDepth > 0) {
    queue.push({
      type: "SCROLL",
      path: currentPath,
      payload: { depth: Math.round(maxScrollDepth), ...metrics },
      ts: Date.now(),
    })
  }

  if (moveCells.size > 0) {
    const cells = [...moveCells.entries()]
      .map(([key, count]) => {
        const [cx, cy] = key.split(":").map(Number)
        return [cx, cy, count] as [number, number, number]
      })
      .sort((a, b) => b[2] - a[2])
      .slice(0, 400)
    queue.push({
      type: "MOVE",
      path: currentPath,
      payload: { cell: MOVE_CELL_PX, cells, ...metrics },
      ts: Date.now(),
    })
  }

  maxScrollDepth = 0
  moveCells = new Map()
}

function updateScrollDepth() {
  const { dh, vh } = documentMetrics()
  const bottom = window.scrollY + vh
  const depth = dh > 0 ? Math.min(100, (bottom / dh) * 100) : 100
  if (depth > maxScrollDepth) maxScrollDepth = depth
}

function bindHeatmapListeners() {
  if (heatmapBound || typeof window === "undefined") return
  heatmapBound = true

  document.addEventListener(
    "click",
    (event) => {
      const metrics = documentMetrics()
      track("CLICK", {
        name: shortSelector(event.target),
        payload: {
          x: Math.round(event.pageX),
          y: Math.round(event.pageY),
          ...metrics,
        },
      })
    },
    { capture: true, passive: true },
  )

  window.addEventListener("scroll", updateScrollDepth, { passive: true })
  window.addEventListener("resize", updateScrollDepth, { passive: true })

  document.addEventListener(
    "mousemove",
    (event) => {
      const now = Date.now()
      if (now - lastMoveSample < 120) return
      lastMoveSample = now
      const key = `${Math.floor(event.pageX / MOVE_CELL_PX)}:${Math.floor(event.pageY / MOVE_CELL_PX)}`
      moveCells.set(key, (moveCells.get(key) ?? 0) + 1)
    },
    { passive: true },
  )
}

function bindListeners() {
  if (listenersBound || typeof window === "undefined") return
  listenersBound = true
  window.addEventListener("pagehide", () => {
    flushPageHeatmap()
    flushAnalytics()
  })
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushPageHeatmap()
      flushAnalytics()
    }
  })
}

export function track(
  type: ClientEventType,
  input: { path?: string; name?: string; payload?: Record<string, unknown> } = {},
) {
  if (typeof window === "undefined" || isEmbedded()) return
  bindListeners()

  queue.push({
    type,
    path: input.path ?? `${window.location.pathname}${window.location.search}`,
    name: input.name,
    payload: input.payload,
    referrer: type === "PAGE_VIEW" ? document.referrer || undefined : undefined,
    ts: Date.now(),
  })

  if (queue.length >= 20) {
    flushAnalytics()
    return
  }

  if (!flushTimer) {
    flushTimer = setTimeout(flushAnalytics, FLUSH_DELAY_MS)
  }
}

export function trackPageView(path: string) {
  if (typeof window === "undefined" || isEmbedded()) return

  // Close out the previous page's heatmap data before switching.
  flushPageHeatmap()
  currentPath = path.split("?")[0]
  bindHeatmapListeners()
  window.setTimeout(updateScrollDepth, 300)

  track("PAGE_VIEW", { path })
  const match = path.match(/^\/products\/([^/?#]+)/)
  if (match) {
    track("PRODUCT_VIEW", { path, name: decodeURIComponent(match[1]) })
  }
}
