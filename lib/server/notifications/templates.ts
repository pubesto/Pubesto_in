import "server-only"

export type OrderSnapshotItem = {
  title: string
  sku: string
  quantity: number
  unitPrice: number
  total: number
}

export type OrderSnapshotAddress = {
  name?: string
  address1?: string
  address2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  phone?: string
}

export type OrderSnapshot = {
  id: string
  number: number
  email: string
  customerName: string
  phone: string | null
  status: "PENDING" | "CONFIRMED" | "FULFILLED" | "CANCELLED"
  currency: string
  subtotal: number
  discount: number
  shipping: number
  tax: number
  total: number
  paymentMethod: string | null
  shippingMethod: string | null
  createdAt: Date
  items: OrderSnapshotItem[]
  shippingAddress: OrderSnapshotAddress | null
  courier?: string | null
  trackingNumber?: string | null
  trackingUrl?: string | null
}

export type OrderNotificationEvent =
  | "ORDER_PLACED"
  | "ORDER_CONFIRMED"
  | "ORDER_FULFILLED"
  | "ORDER_CANCELLED"

export type RenderedEmail = {
  subject: string
  html: string
  text: string
}

export type TemplateContext = {
  storeName: string
  siteUrl: string
  supportEmail: string
}

export function formatMoney(amount: number, currency = "INR") {
  const symbol = currency === "INR" ? "₹" : `${currency} `
  return `${symbol}${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

export function formatOrderNumber(number: number) {
  return `PUB-${String(number).padStart(5, "0")}`
}

function formatDate(date: Date) {
  // The server runs in UTC; customers are in India.
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  })
}

function paymentLabel(method: string | null) {
  const value = (method ?? "").trim().toUpperCase()
  if (!value) return "—"
  if (value === "COD") return "Cash on delivery"
  if (value === "RAZORPAY" || value === "PREPAID") return "Paid online"
  return method!.trim()
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// ── Design tokens (match the storefront) ─────────────────────────────────────
const SEA = "#004a69"
const TURQ = "#30d5c8"
const INK = "#12303b"
const MUTED = "#6f8588"
const LINE = "#e3ebed"
const PAPER = "#f6f4f2"
const TINT = "#eef6f8"
const SLATE = "#4a5d63"
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

type LayoutOptions = {
  /** Browser/tab title. */
  title: string
  /** Inbox preview line shown after the subject. */
  preheader?: string
  /** Small label above the headline, e.g. "Order PUB-00012". */
  eyebrow?: string
  heading: string
  body: string
  /** "muted" for cancellations and rejections. */
  tone?: "brand" | "muted"
}

function layout(ctx: TemplateContext, options: LayoutOptions) {
  const site = escapeHtml(ctx.siteUrl)
  const support = escapeHtml(ctx.supportEmail)
  const heroColor = options.tone === "muted" ? SLATE : SEA
  // Padding stops inbox previews from pulling in body text after a short preheader.
  const preheader = options.preheader
    ? `<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${PAPER};">${escapeHtml(options.preheader)}${"&nbsp;&zwnj;".repeat(60)}</div>`
    : ""

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light only" />
<title>${escapeHtml(options.title)}</title>
<style>
@media only screen and (max-width:480px) {
  .pb-outer { padding:20px 8px 32px !important; }
  .pb-pad { padding-left:20px !important; padding-right:20px !important; }
  .pb-h1 { font-size:22px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background:${PAPER};font-family:${FONT};color:${INK};-webkit-text-size-adjust:100%;">
${preheader}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${PAPER};">
<tr><td align="center" class="pb-outer" style="padding:32px 12px 40px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;">
<tr><td align="center" style="padding:0 0 22px;">
<a href="${site}" style="text-decoration:none;font-family:${FONT};font-size:30px;line-height:1;font-weight:800;letter-spacing:-1.5px;color:${SEA};">${escapeHtml(ctx.storeName.toLowerCase())}<span style="color:${TURQ};">.</span></a>
<div style="margin-top:7px;font-size:10px;font-weight:700;letter-spacing:2.4px;text-transform:uppercase;color:${MUTED};">Everyday essentials</div>
</td></tr>
<tr><td style="background:#ffffff;border:1px solid ${LINE};border-radius:16px;overflow:hidden;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td bgcolor="${heroColor}" class="pb-pad" style="background:${heroColor};padding:30px 32px 28px;border-radius:15px 15px 0 0;">
${options.eyebrow ? `<div style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${TURQ};">${escapeHtml(options.eyebrow)}</div>` : ""}
<h1 class="pb-h1" style="margin:0;font-family:${FONT};font-size:25px;line-height:1.25;font-weight:700;letter-spacing:-0.4px;color:#ffffff;">${escapeHtml(options.heading)}</h1>
</td></tr>
<tr><td class="pb-pad" style="padding:30px 32px 32px;font-size:15px;line-height:1.65;color:${INK};">${options.body}</td></tr>
</table>
</td></tr>
<tr><td align="center" style="padding:24px 16px 0;font-size:12px;line-height:1.7;color:${MUTED};">
Need help? Reply to this email or write to <a href="mailto:${support}" style="color:${SEA};font-weight:600;text-decoration:none;">${support}</a><br />
<a href="${site}" style="color:${MUTED};text-decoration:underline;">Shop</a> &nbsp;·&nbsp;
<a href="${site}/returns/track" style="color:${MUTED};text-decoration:underline;">Track an order</a> &nbsp;·&nbsp;
<a href="${site}/refund-return-policy" style="color:${MUTED};text-decoration:underline;">Returns</a><br />
<span style="color:#9aabae;">© ${new Date().getFullYear()} ${escapeHtml(ctx.storeName)}. All rights reserved.</span>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

function paragraph(html: string, margin = "0 0 14px") {
  return `<p style="margin:${margin};">${html}</p>`
}

function finePrint(html: string) {
  return `<p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:${MUTED};">${html}</p>`
}

function button(href: string, label: string) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0 4px;">
<tr><td align="center" bgcolor="${SEA}" style="background:${SEA};border-radius:999px;">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 32px;font-family:${FONT};font-size:14px;font-weight:700;letter-spacing:0.3px;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
</td></tr>
</table>`
}

/** For emails whose button is the whole point: a copyable link if the button fails. */
function linkFallback(url: string) {
  return finePrint(
    `Button not working? Copy and paste this link into your browser:<br /><a href="${escapeHtml(url)}" style="color:${SEA};word-break:break-all;">${escapeHtml(url)}</a>`,
  )
}

/** Label/value rows in a tinted box. Empty values are skipped. */
function detailsBox(rows: Array<[label: string, value: string | null | undefined]>) {
  const cells = rows
    .filter((row): row is [string, string] => Boolean(row[1] && row[1].trim()))
    .map(
      ([label, value]) => `<tr>
<td valign="top" style="padding:5px 14px 5px 0;font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:${MUTED};white-space:nowrap;">${escapeHtml(label)}</td>
<td valign="top" style="padding:5px 0;font-size:14px;color:${INK};">${value}</td>
</tr>`,
    )
    .join("")
  if (!cells) return ""
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0 0;background:${TINT};border-radius:12px;">
<tr><td style="padding:14px 18px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0">${cells}</table></td></tr>
</table>`
}

function sectionTitle(label: string) {
  return `<div style="margin:28px 0 8px;font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${MUTED};">${escapeHtml(label)}</div>`
}

/** Placed → Confirmed → Shipped progress bar. */
function progressTracker(step: 1 | 2 | 3) {
  const steps = ["Order placed", "Confirmed", "Shipped"]
  const cells = steps
    .map((label, index) => {
      const reached = index < step
      return `<td width="33%" valign="top" style="padding:0 ${index === 2 ? 0 : 6}px 0 0;">
<div style="height:5px;border-radius:5px;background:${reached ? TURQ : LINE};font-size:0;line-height:0;">&nbsp;</div>
<div style="margin-top:8px;font-size:12px;font-weight:${reached ? 700 : 500};color:${reached ? SEA : "#9aabae"};">${label}</div>
</td>`
    })
    .join("")
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0 4px;"><tr>${cells}</tr></table>`
}

function itemsTable(order: OrderSnapshot) {
  const rows = order.items
    .map(
      (item) => `<tr>
<td style="padding:13px 12px 13px 0;border-bottom:1px solid ${LINE};">
<div style="font-size:14px;font-weight:600;color:${INK};">${escapeHtml(item.title)}</div>
<div style="margin-top:2px;font-size:12px;color:${MUTED};">Qty ${item.quantity} × ${formatMoney(item.unitPrice, order.currency)}</div>
</td>
<td align="right" valign="top" style="padding:13px 0;border-bottom:1px solid ${LINE};font-size:14px;font-weight:600;white-space:nowrap;">${formatMoney(item.total, order.currency)}</td>
</tr>`,
    )
    .join("")

  const summaryRow = (label: string, value: string) =>
    `<tr><td style="padding:5px 0;font-size:14px;color:${MUTED};">${label}</td><td align="right" style="padding:5px 0;font-size:14px;color:${INK};white-space:nowrap;">${value}</td></tr>`

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid ${LINE};">
${rows}
<tr><td colspan="2" style="height:8px;font-size:0;line-height:0;">&nbsp;</td></tr>
${summaryRow("Subtotal", formatMoney(order.subtotal, order.currency))}
${order.discount > 0 ? summaryRow("Discount", `−${formatMoney(order.discount, order.currency)}`) : ""}
${summaryRow("Shipping", order.shipping > 0 ? formatMoney(order.shipping, order.currency) : "Free")}
${order.tax > 0 ? summaryRow("GST included", formatMoney(order.tax, order.currency)) : ""}
<tr><td colspan="2" style="height:8px;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr>
<td style="padding:14px 0 0;border-top:2px solid ${SEA};font-size:15px;font-weight:700;color:${INK};">Total</td>
<td align="right" style="padding:14px 0 0;border-top:2px solid ${SEA};font-size:20px;font-weight:800;color:${SEA};white-space:nowrap;">${formatMoney(order.total, order.currency)}</td>
</tr>
</table>`
}

function addressLines(address: OrderSnapshotAddress | null) {
  if (!address) return []
  return [
    address.name,
    address.address1,
    address.address2,
    [address.city, address.state, address.postalCode].filter(Boolean).join(", "),
    address.country,
    address.phone,
  ].filter((line): line is string => Boolean(line && line.trim()))
}

function addressBlock(address: OrderSnapshotAddress | null) {
  const lines = addressLines(address)
  if (!lines.length) return ""
  const [first, ...rest] = lines
  return `${sectionTitle("Delivering to")}
<div style="font-size:14px;line-height:1.6;color:${INK};"><strong>${escapeHtml(first)}</strong>${rest.length ? `<br />${rest.map(escapeHtml).join("<br />")}` : ""}</div>`
}

function itemsText(order: OrderSnapshot) {
  const lines = order.items.map(
    (item) => `- ${item.title} × ${item.quantity}: ${formatMoney(item.total, order.currency)}`,
  )
  lines.push(`Subtotal: ${formatMoney(order.subtotal, order.currency)}`)
  if (order.discount > 0) lines.push(`Discount: -${formatMoney(order.discount, order.currency)}`)
  lines.push(`Shipping: ${order.shipping > 0 ? formatMoney(order.shipping, order.currency) : "Free"}`)
  lines.push(`Total: ${formatMoney(order.total, order.currency)}`)
  return lines.join("\n")
}

function textFooter(ctx: TemplateContext) {
  return `—\n${ctx.storeName} · ${ctx.siteUrl}\nNeed help? ${ctx.supportEmail}`
}

const EVENT_COPY: Record<
  OrderNotificationEvent,
  { subject: (n: string) => string; heading: string; intro: string; step: 1 | 2 | 3 | null }
> = {
  ORDER_PLACED: {
    subject: (n) => `Order ${n} received`,
    heading: "Thank you for your order",
    intro: "We have received your order and will confirm it shortly. Here is a summary for your records.",
    step: 1,
  },
  ORDER_CONFIRMED: {
    subject: (n) => `Order ${n} confirmed`,
    heading: "Your order is confirmed",
    intro: "Your order is confirmed and is now being prepared for dispatch.",
    step: 2,
  },
  ORDER_FULFILLED: {
    subject: (n) => `Order ${n} is on its way`,
    heading: "Your order is on its way",
    intro: "Good news: your order has been shipped. Delivery usually takes 2 to 4 business days.",
    step: 3,
  },
  ORDER_CANCELLED: {
    subject: (n) => `Order ${n} cancelled`,
    heading: "Your order was cancelled",
    intro: "This order has been cancelled. If a payment was made, the refund will be processed to the original method.",
    step: null,
  },
}

function trackingUrlFor(order: OrderSnapshot, ctx: TemplateContext) {
  return `${ctx.siteUrl}/returns/track?orderId=${encodeURIComponent(formatOrderNumber(order.number))}`
}

export function renderOrderEmail(
  event: OrderNotificationEvent,
  order: OrderSnapshot,
  ctx: TemplateContext,
): RenderedEmail {
  const copy = EVENT_COPY[event]
  const number = formatOrderNumber(order.number)
  const trackUrl = trackingUrlFor(order, ctx)
  // Online payments create the order already confirmed.
  const paidOnPlacement = event === "ORDER_PLACED" && order.status === "CONFIRMED"
  const intro = paidOnPlacement
    ? "Your payment was received and your order is confirmed. Here is a summary for your records."
    : copy.intro
  const step = paidOnPlacement ? 2 : copy.step
  const greetingName = order.customerName ? `Hi ${order.customerName},` : "Hi,"
  const hasTracking = event === "ORDER_FULFILLED" && Boolean(order.trackingNumber || order.courier)

  const html = layout(ctx, {
    title: copy.subject(number),
    preheader: intro,
    eyebrow: `Order ${number}`,
    heading: copy.heading,
    tone: event === "ORDER_CANCELLED" ? "muted" : "brand",
    body: `${paragraph(escapeHtml(greetingName), "0 0 6px")}
${paragraph(escapeHtml(intro), "0")}
${step ? progressTracker(step) : ""}
${detailsBox([
  ["Order", `<strong>${number}</strong>`],
  ["Placed on", formatDate(order.createdAt)],
  ["Payment", escapeHtml(paymentLabel(order.paymentMethod))],
  ...(hasTracking
    ? ([
        ["Courier", order.courier ? escapeHtml(order.courier) : null],
        ["Tracking no.", order.trackingNumber ? `<strong>${escapeHtml(order.trackingNumber)}</strong>` : null],
      ] as Array<[string, string | null]>)
    : []),
])}
${sectionTitle("Order summary")}
${itemsTable(order)}
${addressBlock(order.shippingAddress)}
${event === "ORDER_FULFILLED" && order.trackingUrl ? button(order.trackingUrl, "Track your shipment") : event !== "ORDER_CANCELLED" ? button(trackUrl, "Track your order") : button(ctx.siteUrl, "Continue shopping")}`,
  })

  const text = `${copy.heading}

${greetingName}
${intro}

Order ${number} · ${formatDate(order.createdAt)}
Payment: ${paymentLabel(order.paymentMethod)}
${hasTracking ? `Courier: ${order.courier ?? "—"}\nTracking no.: ${order.trackingNumber ?? "—"}\n` : ""}
${itemsText(order)}
${addressLines(order.shippingAddress).length ? `\nDelivering to:\n${addressLines(order.shippingAddress).join("\n")}\n` : ""}
${event !== "ORDER_CANCELLED" ? `Track your order: ${order.trackingUrl || trackUrl}\n` : ""}
${textFooter(ctx)}`

  return { subject: `${copy.subject(number)} · ${ctx.storeName}`, html, text }
}

export function renderAdminOrderEmail(
  order: OrderSnapshot,
  ctx: TemplateContext,
  kind: "NEW" | "CANCELLED" = "NEW",
): RenderedEmail {
  const number = formatOrderNumber(order.number)
  const dashboardUrl = `${ctx.siteUrl}/dashboard/orders/${order.id}`
  const heading = kind === "NEW" ? `New order ${number}` : `Order ${number} cancelled`
  const total = formatMoney(order.total, order.currency)

  const html = layout(ctx, {
    title: heading,
    preheader: `${order.customerName || order.email} · ${total}`,
    eyebrow: kind === "NEW" ? "Store alert · New order" : "Store alert · Cancellation",
    heading: `${heading} · ${total}`,
    tone: kind === "NEW" ? "brand" : "muted",
    body: `${detailsBox([
      ["Customer", `<strong>${escapeHtml(order.customerName || order.email)}</strong>`],
      ["Email", `<a href="mailto:${escapeHtml(order.email)}" style="color:${SEA};text-decoration:none;">${escapeHtml(order.email)}</a>`],
      ["Phone", order.phone ? escapeHtml(order.phone) : null],
      ["Payment", escapeHtml(paymentLabel(order.paymentMethod))],
      ["Shipping", order.shippingMethod ? escapeHtml(order.shippingMethod) : null],
    ]).replace("margin:20px 0 0;", "margin:0;")}
${sectionTitle("Items")}
${itemsTable(order)}
${addressBlock(order.shippingAddress)}
${button(dashboardUrl, "Open in dashboard")}`,
  })

  const text = `${heading}
Customer: ${order.customerName || order.email} (${order.email}${order.phone ? `, ${order.phone}` : ""})
Payment: ${paymentLabel(order.paymentMethod)}

${itemsText(order)}

${dashboardUrl}`
  return { subject: `${heading} · ${total}`, html, text }
}

/**
 * WhatsApp body parameters, in the order the approved template expects:
 * {{1}} customer name, {{2}} order number, {{3}} total, {{4}} tracking link.
 */
export function renderOrderWhatsApp(
  event: OrderNotificationEvent,
  order: OrderSnapshot,
  ctx: TemplateContext,
) {
  const copy = EVENT_COPY[event]
  const number = formatOrderNumber(order.number)
  const total = formatMoney(order.total, order.currency)
  const trackUrl = trackingUrlFor(order, ctx)
  const name = order.customerName || "there"

  return {
    parameters: [name, number, total, trackUrl],
    fallbackText: `${ctx.storeName}: ${copy.heading}.\nHi ${name}, ${copy.intro}\nOrder ${number} · ${total}\n${event !== "ORDER_CANCELLED" ? `Track: ${trackUrl}` : ""}`.trim(),
  }
}

export function renderAdminOrderWhatsApp(order: OrderSnapshot, ctx: TemplateContext) {
  const number = formatOrderNumber(order.number)
  const total = formatMoney(order.total, order.currency)
  const dashboardUrl = `${ctx.siteUrl}/dashboard/orders/${order.id}`
  return {
    parameters: [order.customerName || order.email, number, total, dashboardUrl],
    fallbackText: `New order ${number} from ${order.customerName || order.email} · ${total}\n${dashboardUrl}`,
  }
}

export type AuthEmailKind = "PASSWORD_RESET" | "VERIFY_EMAIL"

export function renderAuthEmail(
  kind: AuthEmailKind,
  input: { name: string; url: string },
  ctx: TemplateContext,
): RenderedEmail {
  const greeting = input.name ? `Hi ${input.name},` : "Hi,"

  if (kind === "PASSWORD_RESET") {
    const intro = `We received a request to reset the password for your ${ctx.storeName} account. Tap the button below to choose a new one.`
    const html = layout(ctx, {
      title: "Reset your password",
      preheader: "Choose a new password. This link expires in one hour.",
      eyebrow: "Account security",
      heading: "Reset your password",
      body: `${paragraph(escapeHtml(greeting), "0 0 6px")}
${paragraph(escapeHtml(intro), "0")}
${button(input.url, "Choose a new password")}
${finePrint("This link expires in <strong>one hour</strong> and can be used once. If you did not request a password reset, you can safely ignore this email. Your password will not change.")}
${linkFallback(input.url)}`,
    })
    return {
      subject: `Reset your ${ctx.storeName} password`,
      html,
      text: `Reset your password

${greeting}
${intro}

${input.url}

This link expires in one hour. If you did not request this, ignore this email and your password will not change.

${textFooter(ctx)}`,
    }
  }

  const intro = "Please confirm your email address to activate order tracking and faster checkout."
  const html = layout(ctx, {
    title: "Verify your email",
    preheader: intro,
    eyebrow: "Welcome",
    heading: `Welcome to ${ctx.storeName}`,
    body: `${paragraph(escapeHtml(greeting), "0 0 6px")}
${paragraph(escapeHtml(intro), "0")}
${button(input.url, "Verify email address")}
${linkFallback(input.url)}`,
  })
  return {
    subject: `Verify your ${ctx.storeName} email`,
    html,
    text: `Welcome to ${ctx.storeName}

${greeting}
${intro}

${input.url}

${textFooter(ctx)}`,
  }
}

export function renderDraftOrderEmail(
  draft: {
    number: number
    email: string
    customerName: string
    currency: string
    subtotal: number
    discount: number
    shipping: number
    total: number
    items: OrderSnapshotItem[]
  },
  ctx: TemplateContext,
): RenderedEmail {
  const number = `#DRAFT-${String(draft.number).padStart(5, "0")}`
  const snapshot: OrderSnapshot = {
    id: "",
    number: draft.number,
    email: draft.email,
    customerName: draft.customerName,
    phone: null,
    status: "PENDING",
    currency: draft.currency,
    subtotal: draft.subtotal,
    discount: draft.discount,
    shipping: draft.shipping,
    tax: 0,
    total: draft.total,
    paymentMethod: null,
    shippingMethod: null,
    createdAt: new Date(),
    items: draft.items,
    shippingAddress: null,
  }
  const greeting = draft.customerName ? `Hi ${draft.customerName},` : "Hi,"
  const intro = "Our team has prepared the following order for you. Reply to this email to confirm and we will complete it for you."
  const html = layout(ctx, {
    title: `Your ${ctx.storeName} order proposal`,
    preheader: intro,
    eyebrow: `Proposal ${number}`,
    heading: "Your order proposal",
    body: `${paragraph(escapeHtml(greeting), "0 0 6px")}
${paragraph(escapeHtml(intro), "0")}
${sectionTitle("Proposed order")}
${itemsTable(snapshot)}
${finePrint("Nothing is charged until you confirm. Just reply to this email and we will take it from there.")}`,
  })
  return {
    subject: `Your ${ctx.storeName} order proposal ${number}`,
    html,
    text: `Your order proposal ${number}

${greeting}
${intro}

${itemsText(snapshot)}

${textFooter(ctx)}`,
  }
}

export function renderContactAdminEmail(
  message: { name: string; email: string; subject: string; message: string; createdAt: Date },
  ctx: TemplateContext,
): RenderedEmail {
  const html = layout(ctx, {
    title: `Contact form: ${message.subject}`,
    preheader: `${message.name}: ${message.message.slice(0, 120)}`,
    eyebrow: "Store alert · Contact form",
    heading: message.subject || "New contact message",
    body: `${detailsBox([
      ["From", `<strong>${escapeHtml(message.name)}</strong>`],
      ["Email", `<a href="mailto:${escapeHtml(message.email)}" style="color:${SEA};text-decoration:none;">${escapeHtml(message.email)}</a>`],
      ["Received", formatDate(message.createdAt)],
    ]).replace("margin:20px 0 0;", "margin:0;")}
${sectionTitle("Message")}
<div style="font-size:15px;line-height:1.65;white-space:pre-wrap;border-left:3px solid ${TURQ};padding:2px 0 2px 16px;color:${INK};">${escapeHtml(message.message)}</div>
${finePrint("Reply to this email to answer the customer directly.")}`,
  })
  return {
    subject: `[Contact] ${message.subject} — ${message.name}`,
    html,
    text: `From: ${message.name} <${message.email}>\nSubject: ${message.subject}\n\n${message.message}`,
  }
}

export function renderContactAcknowledgementEmail(
  message: { name: string; subject: string },
  ctx: TemplateContext,
): RenderedEmail {
  const greeting = message.name ? `Hi ${message.name},` : "Hi,"
  const intro = `Thanks for reaching out about “${message.subject}”. Our team replies within 24 hours on business days.`
  const html = layout(ctx, {
    title: "We received your message",
    preheader: "Our team replies within 24 hours on business days.",
    eyebrow: "Customer care",
    heading: "We received your message",
    body: `${paragraph(escapeHtml(greeting), "0 0 6px")}
${paragraph(escapeHtml(intro), "0")}
${button(ctx.siteUrl, "Continue shopping")}`,
  })
  return {
    subject: `We received your message · ${ctx.storeName}`,
    html,
    text: `We received your message

${greeting}
${intro}

${textFooter(ctx)}`,
  }
}

export type ReturnSnapshot = {
  id: string
  orderRef: string
  customerName: string
  customerEmail: string
  customerPhone: string
  productName: string
  reason: string
  reasonText: string
  status: string
  /** Latest customer-facing timeline entry. */
  label: string
  note: string
}

/** Customer email for a new return request and for each status change after it. */
export function renderReturnEmail(ret: ReturnSnapshot, ctx: TemplateContext): RenderedEmail {
  const trackUrl = `${ctx.siteUrl}/returns/track?id=${encodeURIComponent(ret.id)}`
  const greeting = ret.customerName && ret.customerName !== "Customer" ? `Hi ${ret.customerName},` : "Hi,"
  const html = layout(ctx, {
    title: `${ret.label} · Return ${ret.id}`,
    preheader: ret.note,
    eyebrow: `Return ${ret.id}`,
    heading: ret.label,
    tone: ret.status === "rejected" ? "muted" : "brand",
    body: `${paragraph(escapeHtml(greeting), "0 0 6px")}
${paragraph(escapeHtml(ret.note), "0")}
${detailsBox([
  ["Return ID", `<strong>${escapeHtml(ret.id)}</strong>`],
  ["Order", escapeHtml(ret.orderRef)],
  ["Product", ret.productName ? escapeHtml(ret.productName) : null],
  ["Reason", escapeHtml(ret.reason)],
])}
${button(trackUrl, "Track your return")}`,
  })
  return {
    subject: `${ret.label} · Return ${ret.id} · ${ctx.storeName}`,
    html,
    text: `${ret.label}

${greeting}
${ret.note}

Return ID: ${ret.id}
Order: ${ret.orderRef}
${ret.productName ? `Product: ${ret.productName}\n` : ""}Reason: ${ret.reason}

Track your return: ${trackUrl}

${textFooter(ctx)}`,
  }
}

export function renderAdminReturnEmail(ret: ReturnSnapshot, ctx: TemplateContext): RenderedEmail {
  const dashboardUrl = `${ctx.siteUrl}/dashboard/returns`
  const html = layout(ctx, {
    title: `New return request ${ret.id}`,
    preheader: `${ret.customerName} · ${ret.orderRef} · ${ret.reason}`,
    eyebrow: "Store alert · Return request",
    heading: `New return request ${ret.id}`,
    body: `${detailsBox([
      ["Customer", `<strong>${escapeHtml(ret.customerName)}</strong>`],
      ["Email", `<a href="mailto:${escapeHtml(ret.customerEmail)}" style="color:${SEA};text-decoration:none;">${escapeHtml(ret.customerEmail)}</a>`],
      ["Phone", ret.customerPhone ? escapeHtml(ret.customerPhone) : null],
      ["Order", escapeHtml(ret.orderRef)],
      ["Product", ret.productName ? escapeHtml(ret.productName) : null],
      ["Reason", escapeHtml(ret.reason)],
    ]).replace("margin:20px 0 0;", "margin:0;")}
${ret.reasonText ? `${sectionTitle("Customer's note")}<div style="font-size:15px;line-height:1.65;white-space:pre-wrap;border-left:3px solid ${TURQ};padding:2px 0 2px 16px;">${escapeHtml(ret.reasonText)}</div>` : ""}
${button(dashboardUrl, "Review in dashboard")}`,
  })
  return {
    subject: `New return request ${ret.id} · ${ret.orderRef}`,
    html,
    text: `New return request ${ret.id}
Customer: ${ret.customerName} (${ret.customerEmail}${ret.customerPhone ? `, ${ret.customerPhone}` : ""})
Order: ${ret.orderRef}
${ret.productName ? `Product: ${ret.productName}\n` : ""}Reason: ${ret.reason}
${ret.reasonText ? `\n${ret.reasonText}\n` : ""}
${dashboardUrl}`,
  }
}
