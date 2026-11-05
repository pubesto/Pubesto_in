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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function layout(ctx: TemplateContext, title: string, bodyHtml: string, preheader = "") {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Helvetica,Arial,sans-serif;color:#111;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f4;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;">
<tr><td style="background:#004a69;color:#fff;padding:22px 28px;font-size:20px;letter-spacing:0.08em;font-weight:700;">${escapeHtml(ctx.storeName)}</td></tr>
<tr><td style="padding:28px;font-size:14px;line-height:1.65;">${bodyHtml}</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #e5e5e5;font-size:12px;line-height:1.6;color:#666;">
Questions? Reply to this email or write to <a href="mailto:${escapeHtml(ctx.supportEmail)}" style="color:#111;">${escapeHtml(ctx.supportEmail)}</a>.<br />
<a href="${escapeHtml(ctx.siteUrl)}" style="color:#111;">${escapeHtml(ctx.siteUrl.replace(/^https?:\/\//, ""))}</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

function button(href: string, label: string) {
  return `<p style="margin:24px 0;"><a href="${escapeHtml(href)}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:14px 26px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;">${escapeHtml(label)}</a></p>`
}

function itemsTable(order: OrderSnapshot) {
  const rows = order.items
    .map(
      (item) => `<tr>
<td style="padding:10px 0;border-bottom:1px solid #eee;">${escapeHtml(item.title)}<br /><span style="color:#777;font-size:12px;">Qty ${item.quantity} × ${formatMoney(item.unitPrice, order.currency)}</span></td>
<td align="right" style="padding:10px 0;border-bottom:1px solid #eee;white-space:nowrap;">${formatMoney(item.total, order.currency)}</td>
</tr>`,
    )
    .join("")

  const summaryRow = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:6px 0;color:${bold ? "#111" : "#555"};${bold ? "font-weight:600;" : ""}">${label}</td><td align="right" style="padding:6px 0;${bold ? "font-weight:600;" : ""}">${value}</td></tr>`

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;">
${rows}
${summaryRow("Subtotal", formatMoney(order.subtotal, order.currency))}
${order.discount > 0 ? summaryRow("Discount", `-${formatMoney(order.discount, order.currency)}`) : ""}
${summaryRow("Shipping", order.shipping > 0 ? formatMoney(order.shipping, order.currency) : "Free")}
${order.tax > 0 ? summaryRow("GST included", formatMoney(order.tax, order.currency)) : ""}
${summaryRow("Total", formatMoney(order.total, order.currency), true)}
</table>`
}

function addressBlock(address: OrderSnapshotAddress | null) {
  if (!address) return ""
  const lines = [
    address.name,
    address.address1,
    address.address2,
    [address.city, address.state, address.postalCode].filter(Boolean).join(", "),
    address.country,
    address.phone,
  ].filter((line): line is string => Boolean(line && line.trim()))
  if (!lines.length) return ""
  return `<p style="margin:18px 0 0;"><strong>Shipping to</strong><br />${lines.map(escapeHtml).join("<br />")}</p>`
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

const EVENT_COPY: Record<
  OrderNotificationEvent,
  { subject: (n: string) => string; heading: string; intro: string }
> = {
  ORDER_PLACED: {
    subject: (n) => `Order ${n} received`,
    heading: "Thank you for your order",
    intro: "We have received your order and will confirm it shortly. Here is a summary for your records.",
  },
  ORDER_CONFIRMED: {
    subject: (n) => `Order ${n} confirmed`,
    heading: "Your order is confirmed",
    intro: "Payment has been received and your order is now being prepared.",
  },
  ORDER_FULFILLED: {
    subject: (n) => `Order ${n} is on its way`,
    heading: "Your order has shipped",
    intro: "Your order has left our studio. Delivery usually takes 2 to 4 business days.",
  },
  ORDER_CANCELLED: {
    subject: (n) => `Order ${n} cancelled`,
    heading: "Your order was cancelled",
    intro: "This order has been cancelled. If a payment was made, the refund will be processed to the original method.",
  },
}

export function renderOrderEmail(
  event: OrderNotificationEvent,
  order: OrderSnapshot,
  ctx: TemplateContext,
): RenderedEmail {
  const copy = EVENT_COPY[event]
  const number = formatOrderNumber(order.number)
  const greeting = order.customerName ? `Hi ${escapeHtml(order.customerName)},` : "Hi,"
  const trackUrl = `${ctx.siteUrl}/returns/track?orderId=${encodeURIComponent(`PUB-${String(order.number).padStart(5, "0")}`)}`

  const html = layout(
    ctx,
    copy.subject(number),
    `<h1 style="margin:0 0 12px;font-size:20px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">${copy.heading}</h1>
<p style="margin:0 0 8px;">${greeting}</p>
<p style="margin:0 0 18px;">${copy.intro}</p>
<p style="margin:0 0 18px;color:#555;">Order <strong style="color:#111;">${number}</strong> · ${order.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
${itemsTable(order)}
${addressBlock(order.shippingAddress)}
${event !== "ORDER_CANCELLED" ? button(trackUrl, "Track your order") : ""}`,
    copy.intro,
  )

  const text = `${copy.heading}

${order.customerName ? `Hi ${order.customerName},` : "Hi,"}
${copy.intro}

Order ${number}
${itemsText(order)}

${event !== "ORDER_CANCELLED" ? `Track your order: ${trackUrl}` : ""}

${ctx.storeName} · ${ctx.supportEmail}`

  return { subject: `${copy.subject(number)} · ${ctx.storeName}`, html, text }
}

export function renderAdminNewOrderEmail(order: OrderSnapshot, ctx: TemplateContext): RenderedEmail {
  const number = formatOrderNumber(order.number)
  const dashboardUrl = `${ctx.siteUrl}/dashboard/orders/${order.id}`
  const html = layout(
    ctx,
    `New order ${number}`,
    `<h1 style="margin:0 0 12px;font-size:18px;font-weight:600;">New order ${number}</h1>
<p style="margin:0 0 6px;">Customer: <strong>${escapeHtml(order.customerName || order.email)}</strong> · ${escapeHtml(order.email)}${order.phone ? ` · ${escapeHtml(order.phone)}` : ""}</p>
<p style="margin:0 0 18px;color:#555;">Payment: ${escapeHtml(order.paymentMethod ?? "—")} · Shipping: ${escapeHtml(order.shippingMethod ?? "—")}</p>
${itemsTable(order)}
${addressBlock(order.shippingAddress)}
${button(dashboardUrl, "Open in dashboard")}`,
  )
  const text = `New order ${number}
Customer: ${order.customerName || order.email} (${order.email}${order.phone ? `, ${order.phone}` : ""})
${itemsText(order)}
${dashboardUrl}`
  return { subject: `New order ${number} · ${formatMoney(order.total, order.currency)}`, html, text }
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
  const trackUrl = `${ctx.siteUrl}/returns/track?orderId=${encodeURIComponent(`PUB-${String(order.number).padStart(5, "0")}`)}`
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
  const greeting = input.name ? `Hi ${escapeHtml(input.name)},` : "Hi,"
  if (kind === "PASSWORD_RESET") {
    const html = layout(
      ctx,
      "Reset your password",
      `<h1 style="margin:0 0 12px;font-size:20px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Reset your password</h1>
<p style="margin:0 0 8px;">${greeting}</p>
<p style="margin:0;">We received a request to reset the password for your ${escapeHtml(ctx.storeName)} account. This link expires in one hour.</p>
${button(input.url, "Choose a new password")}
<p style="margin:0;color:#666;font-size:12px;">If you did not request this, you can safely ignore this email.</p>`,
    )
    return {
      subject: `Reset your ${ctx.storeName} password`,
      html,
      text: `Reset your password\n\n${input.url}\n\nIf you did not request this, ignore this email.`,
    }
  }

  const html = layout(
    ctx,
    "Verify your email",
    `<h1 style="margin:0 0 12px;font-size:20px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Welcome to ${escapeHtml(ctx.storeName)}</h1>
<p style="margin:0 0 8px;">${greeting}</p>
<p style="margin:0;">Please confirm your email address to activate order tracking and faster checkout.</p>
${button(input.url, "Verify email address")}`,
  )
  return {
    subject: `Verify your ${ctx.storeName} email`,
    html,
    text: `Welcome to ${ctx.storeName}. Verify your email:\n\n${input.url}`,
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
  const html = layout(
    ctx,
    `Your ${ctx.storeName} order proposal`,
    `<h1 style="margin:0 0 12px;font-size:20px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Your order proposal</h1>
<p style="margin:0 0 8px;">${draft.customerName ? `Hi ${escapeHtml(draft.customerName)},` : "Hi,"}</p>
<p style="margin:0 0 18px;">Our team has prepared the following order for you (${number}). Reply to this email to confirm and we will complete it for you.</p>
${itemsTable(snapshot)}`,
  )
  return {
    subject: `Your ${ctx.storeName} order proposal ${number}`,
    html,
    text: `Your order proposal ${number}\n\n${itemsText(snapshot)}\n\nReply to confirm.`,
  }
}

export function renderContactAdminEmail(
  message: { name: string; email: string; subject: string; message: string; createdAt: Date },
  ctx: TemplateContext,
): RenderedEmail {
  const html = layout(
    ctx,
    `Contact form: ${message.subject}`,
    `<h1 style="margin:0 0 12px;font-size:18px;font-weight:600;">New contact message</h1>
<p style="margin:0 0 4px;"><strong>${escapeHtml(message.name)}</strong> · <a href="mailto:${escapeHtml(message.email)}" style="color:#111;">${escapeHtml(message.email)}</a></p>
<p style="margin:0 0 16px;color:#555;">Subject: ${escapeHtml(message.subject)}</p>
<p style="margin:0;white-space:pre-wrap;border-left:3px solid #000;padding-left:14px;">${escapeHtml(message.message)}</p>`,
  )
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
  const html = layout(
    ctx,
    "We received your message",
    `<h1 style="margin:0 0 12px;font-size:20px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">We received your message</h1>
<p style="margin:0 0 8px;">${message.name ? `Hi ${escapeHtml(message.name)},` : "Hi,"}</p>
<p style="margin:0;">Thanks for reaching out about “${escapeHtml(message.subject)}”. Our client services team replies within 24 hours on business days.</p>`,
  )
  return {
    subject: `We received your message · ${ctx.storeName}`,
    html,
    text: `Thanks for reaching out about "${message.subject}". We reply within 24 hours on business days.`,
  }
}
