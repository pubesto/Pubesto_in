/**
 * Traffic-source attribution. Turns a referrer, UTM parameters and click ids
 * into a normalised channel so the dashboard can answer "where did this
 * visitor come from": Instagram, Facebook, WhatsApp, Google, and so on.
 *
 * Shared by the server (classification at session start) and the dashboard
 * (labels and ordering).
 */

export type TrafficChannel =
  | "instagram"
  | "facebook"
  | "meta-ads"
  | "whatsapp"
  | "google"
  | "google-ads"
  | "youtube"
  | "x"
  | "pinterest"
  | "tiktok"
  | "snapchat"
  | "linkedin"
  | "telegram"
  | "threads"
  | "other-search"
  | "email"
  | "sms"
  | "referral"
  | "direct"

export const TRAFFIC_CHANNEL_LABELS: Record<TrafficChannel, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  "meta-ads": "Meta Ads",
  whatsapp: "WhatsApp",
  google: "Google",
  "google-ads": "Google Ads",
  youtube: "YouTube",
  x: "X / Twitter",
  pinterest: "Pinterest",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  linkedin: "LinkedIn",
  telegram: "Telegram",
  threads: "Threads",
  "other-search": "Other search",
  email: "Email",
  sms: "SMS",
  referral: "Other websites",
  direct: "Direct / typed",
}

export const SOCIAL_CHANNELS: TrafficChannel[] = [
  "instagram",
  "facebook",
  "meta-ads",
  "whatsapp",
  "youtube",
  "x",
  "pinterest",
  "tiktok",
  "snapchat",
  "linkedin",
  "telegram",
  "threads",
]

export function channelLabel(channel: string): string {
  return (TRAFFIC_CHANNEL_LABELS as Record<string, string>)[channel] ?? channel
}

export type TrafficClassificationInput = {
  referrer?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  fbclid?: string | null
  gclid?: string | null
}

export type TrafficClassification = {
  channel: TrafficChannel
  /** Human-readable origin: referring host or utm_source. */
  source: string | null
  medium: string | null
}

const PAID_MEDIUMS = new Set(["cpc", "ppc", "paid", "paidsocial", "paid_social", "paid-social", "ads", "ad", "display", "cpm"])

function hostOf(referrer: string | null | undefined): string | null {
  if (!referrer) return null
  try {
    const url = new URL(referrer)
    // Android app referrers look like android-app://com.instagram.android
    if (url.protocol === "android-app:") return `android-app://${url.host || url.pathname.replace(/^\/+/, "")}`
    return url.host.toLowerCase().replace(/^www\./, "")
  } catch {
    return null
  }
}

function channelFromHost(host: string): TrafficChannel | null {
  if (host.startsWith("android-app://")) {
    const pkg = host.slice("android-app://".length)
    if (pkg.includes("instagram")) return "instagram"
    if (pkg.includes("facebook") || pkg.includes("katana") || pkg.includes("orca")) return "facebook"
    if (pkg.includes("whatsapp")) return "whatsapp"
    if (pkg.includes("youtube")) return "youtube"
    if (pkg.includes("twitter") || pkg.includes("x.android")) return "x"
    if (pkg.includes("pinterest")) return "pinterest"
    if (pkg.includes("tiktok") || pkg.includes("musically")) return "tiktok"
    if (pkg.includes("snapchat")) return "snapchat"
    if (pkg.includes("linkedin")) return "linkedin"
    if (pkg.includes("telegram")) return "telegram"
    if (pkg.includes("threads")) return "threads"
    if (pkg.includes("gm") || pkg.includes("email") || pkg.includes("mail")) return "email"
    if (pkg.includes("googlequicksearchbox") || pkg.includes("google.android.gm")) return "google"
    return "referral"
  }

  if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram"
  if (host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.me" || host === "fb.com" || host === "messenger.com") return "facebook"
  if (host === "whatsapp.com" || host.endsWith(".whatsapp.com") || host === "wa.me") return "whatsapp"
  if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") return "youtube"
  if (host === "google.com" || host.startsWith("google.") || host.endsWith(".google.com") || /^google\.[a-z.]+$/.test(host)) return "google"
  if (host === "t.co" || host === "twitter.com" || host === "x.com" || host.endsWith(".twitter.com")) return "x"
  if (host === "pinterest.com" || host.endsWith(".pinterest.com") || host === "pin.it") return "pinterest"
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok"
  if (host === "snapchat.com" || host.endsWith(".snapchat.com")) return "snapchat"
  if (host === "linkedin.com" || host.endsWith(".linkedin.com") || host === "lnkd.in") return "linkedin"
  if (host === "t.me" || host === "telegram.org" || host.endsWith(".telegram.org")) return "telegram"
  if (host === "threads.net" || host.endsWith(".threads.net") || host === "threads.com") return "threads"
  if (host.includes("bing.com") || host.includes("duckduckgo.com") || host.includes("yahoo.") || host.includes("yandex.") || host.includes("baidu.com") || host.includes("ecosia.org")) return "other-search"
  if (host === "mail.google.com" || host.includes("outlook.") || host.includes("mail.yahoo") || host.includes("protonmail") || host.includes("mail.")) return "email"
  return "referral"
}

function channelFromUtmSource(source: string, medium: string | null): TrafficChannel | null {
  const value = source.toLowerCase().trim()
  const paid = medium ? PAID_MEDIUMS.has(medium.toLowerCase()) : false

  if (["ig", "insta", "instagram"].includes(value)) return paid ? "meta-ads" : "instagram"
  if (["fb", "facebook", "meta", "fbig", "fb_ig", "facebook_ads", "meta_ads"].includes(value)) return paid ? "meta-ads" : "facebook"
  if (["wa", "whatsapp", "whats-app", "whatsapp_business"].includes(value)) return "whatsapp"
  if (["google", "adwords", "google_ads", "googleads", "gads"].includes(value)) return paid || value !== "google" ? "google-ads" : "google"
  if (["youtube", "yt"].includes(value)) return "youtube"
  if (["twitter", "x", "t.co"].includes(value)) return "x"
  if (["pinterest", "pin"].includes(value)) return "pinterest"
  if (["tiktok", "tt"].includes(value)) return "tiktok"
  if (["snapchat", "snap"].includes(value)) return "snapchat"
  if (["linkedin", "li"].includes(value)) return "linkedin"
  if (["telegram", "tg"].includes(value)) return "telegram"
  if (["threads"].includes(value)) return "threads"
  if (["email", "newsletter", "mail", "mailchimp", "klaviyo", "resend"].includes(value)) return "email"
  if (["sms", "text"].includes(value)) return "sms"
  if (["bing", "duckduckgo", "yahoo"].includes(value)) return "other-search"
  if (["direct", "(direct)"].includes(value)) return "direct"
  return null
}

export function classifyTraffic(input: TrafficClassificationInput): TrafficClassification {
  const medium = input.utmMedium?.trim().toLowerCase() || null
  const utmSource = input.utmSource?.trim() || null
  const host = hostOf(input.referrer)

  // 1. Explicit campaign tags win.
  if (utmSource) {
    const fromUtm = channelFromUtmSource(utmSource, medium)
    if (fromUtm) return { channel: fromUtm, source: utmSource.toLowerCase(), medium }
    if (medium === "email") return { channel: "email", source: utmSource.toLowerCase(), medium }
    if (medium === "sms") return { channel: "sms", source: utmSource.toLowerCase(), medium }
    if (medium && PAID_MEDIUMS.has(medium)) return { channel: "referral", source: utmSource.toLowerCase(), medium }
    return { channel: "referral", source: utmSource.toLowerCase(), medium }
  }

  // 2. Ad click identifiers.
  if (input.gclid) return { channel: "google-ads", source: host ?? "google", medium: medium ?? "cpc" }
  if (input.fbclid) {
    const fromHost = host ? channelFromHost(host) : null
    if (fromHost === "instagram") return { channel: "instagram", source: host, medium: medium ?? "social" }
    if (fromHost === "facebook") return { channel: "facebook", source: host, medium: medium ?? "social" }
    return { channel: "meta-ads", source: host ?? "meta", medium: medium ?? "paid-social" }
  }

  // 3. Referring site or app.
  if (host) {
    const fromHost = channelFromHost(host)
    if (fromHost) return { channel: fromHost, source: host, medium: medium ?? (SOCIAL_CHANNELS.includes(fromHost) ? "social" : fromHost === "google" || fromHost === "other-search" ? "organic" : "referral") }
  }

  // 4. Nothing to go on: typed URL, bookmark, or an app that strips referrers
  //    (WhatsApp and Instagram DMs usually land here unless links carry UTMs).
  return { channel: "direct", source: null, medium: medium ?? null }
}

/** Order channels the way the dashboard lists them. */
export const CHANNEL_DISPLAY_ORDER: TrafficChannel[] = [
  "instagram",
  "facebook",
  "meta-ads",
  "whatsapp",
  "google",
  "google-ads",
  "youtube",
  "email",
  "sms",
  "x",
  "threads",
  "pinterest",
  "tiktok",
  "snapchat",
  "linkedin",
  "telegram",
  "other-search",
  "referral",
  "direct",
]
