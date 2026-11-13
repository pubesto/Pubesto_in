import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { getPrisma } from "@/lib/server/db"
import { getEmailEnv, getSiteEnv, getSiteUrl, getWhatsAppEnv } from "@/lib/server/env"

import { sendEmail, type DeliveryResult } from "./email"
import {
  renderAdminNewOrderEmail,
  renderAdminOrderWhatsApp,
  renderAuthEmail,
  renderContactAcknowledgementEmail,
  renderContactAdminEmail,
  renderDraftOrderEmail,
  renderOrderEmail,
  renderOrderWhatsApp,
  type AuthEmailKind,
  type OrderNotificationEvent,
  type OrderSnapshot,
  type OrderSnapshotAddress,
  type TemplateContext,
} from "./templates"
import { getWhatsAppTemplateName, normalizeWhatsAppNumber, sendWhatsAppMessage } from "./whatsapp"

export type { OrderNotificationEvent } from "./templates"

function templateContext(): TemplateContext {
  const env = getSiteEnv()
  return {
    storeName: env.STORE_NAME,
    siteUrl: getSiteUrl(),
    supportEmail: env.STORE_SUPPORT_EMAIL,
  }
}

type RecordInput = {
  channel: "EMAIL" | "WHATSAPP"
  template: string
  recipient: string
  subject?: string
  orderId?: string | null
  userId?: string | null
  payload?: Prisma.InputJsonValue
}

/**
 * Writes a PENDING row, runs the send, then stores the outcome. Any failure is
 * captured on the row; nothing here throws into the caller.
 */
async function recordAndSend(input: RecordInput, send: () => Promise<DeliveryResult>) {
  const prisma = getPrisma()
  let notificationId: string | null = null

  try {
    const created = await prisma.notification.create({
      data: {
        channel: input.channel,
        template: input.template,
        recipient: input.recipient,
        subject: input.subject,
        orderId: input.orderId ?? null,
        userId: input.userId ?? null,
        payload: input.payload,
      },
      select: { id: true },
    })
    notificationId = created.id
  } catch (error) {
    console.error("[notifications] could not record notification", error)
  }

  const result = await send()

  if (notificationId) {
    try {
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: result.status,
          error: result.error,
          providerId: result.providerId,
          sentAt: result.status === "SENT" ? new Date() : null,
        },
      })
    } catch (error) {
      console.error("[notifications] could not update notification", error)
    }
  }

  if (result.status === "FAILED") {
    console.error(`[notifications] ${input.channel} ${input.template} to ${input.recipient} failed: ${result.error}`)
  }

  return result
}

function toAddress(value: Prisma.JsonValue | null | undefined): OrderSnapshotAddress | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const pick = (key: string) => (typeof record[key] === "string" ? (record[key] as string) : undefined)
  return {
    name: pick("name"),
    address1: pick("address1"),
    address2: pick("address2"),
    city: pick("city"),
    state: pick("state"),
    postalCode: pick("postalCode"),
    country: pick("country"),
    phone: pick("phone"),
  }
}

async function loadOrderSnapshot(orderId: string): Promise<OrderSnapshot | null> {
  const order = await getPrisma().order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      email: true,
      phone: true,
      status: true,
      currency: true,
      subtotal: true,
      discount: true,
      shipping: true,
      tax: true,
      total: true,
      paymentMethod: true,
      shippingMethod: true,
      shippingAddress: true,
      createdAt: true,
      user: { select: { id: true, name: true, phone: true } },
      items: {
        select: { title: true, sku: true, quantity: true, unitPrice: true, total: true },
      },
    },
  })

  if (!order) return null

  const address = toAddress(order.shippingAddress)

  return {
    id: order.id,
    number: order.number,
    email: order.email,
    customerName: address?.name || order.user?.name || "",
    phone: order.phone ?? address?.phone ?? order.user?.phone ?? null,
    status: order.status,
    currency: order.currency,
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    shipping: Number(order.shipping),
    tax: Number(order.tax),
    total: Number(order.total),
    paymentMethod: order.paymentMethod,
    shippingMethod: order.shippingMethod,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      title: item.title,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
    })),
    shippingAddress: address,
  }
}

const EVENT_TO_WHATSAPP_KEY: Record<
  OrderNotificationEvent,
  "ORDER_PLACED" | "ORDER_CONFIRMED" | "ORDER_FULFILLED" | "ORDER_CANCELLED"
> = {
  ORDER_PLACED: "ORDER_PLACED",
  ORDER_CONFIRMED: "ORDER_CONFIRMED",
  ORDER_FULFILLED: "ORDER_FULFILLED",
  ORDER_CANCELLED: "ORDER_CANCELLED",
}

/**
 * Customer email + WhatsApp for one order lifecycle event, plus admin alerts
 * for new storefront orders.
 */
export async function notifyOrderEvent(
  orderId: string,
  event: OrderNotificationEvent,
  options: { notifyAdmin?: boolean } = {},
) {
  try {
    const order = await loadOrderSnapshot(orderId)
    if (!order) return

    const ctx = templateContext()
    const userId = await getPrisma()
      .order.findUnique({ where: { id: orderId }, select: { userId: true } })
      .then((row) => row?.userId ?? null)

    const email = renderOrderEmail(event, order, ctx)
    await recordAndSend(
      {
        channel: "EMAIL",
        template: event,
        recipient: order.email,
        subject: email.subject,
        orderId,
        userId,
      },
      () => sendEmail({ to: order.email, subject: email.subject, html: email.html, text: email.text }),
    )

    const phone = normalizeWhatsAppNumber(order.phone)
    if (phone) {
      const wa = renderOrderWhatsApp(event, order, ctx)
      await recordAndSend(
        {
          channel: "WHATSAPP",
          template: event,
          recipient: phone,
          orderId,
          userId,
          payload: { parameters: wa.parameters },
        },
        () =>
          sendWhatsAppMessage({
            to: phone,
            template: getWhatsAppTemplateName(EVENT_TO_WHATSAPP_KEY[event]),
            parameters: wa.parameters,
            fallbackText: wa.fallbackText,
          }),
      )
    }

    if (options.notifyAdmin) {
      await notifyAdminNewOrder(order, orderId, ctx)
    }
  } catch (error) {
    console.error(`[notifications] notifyOrderEvent(${event}) failed for ${orderId}`, error)
  }
}

async function notifyAdminNewOrder(order: OrderSnapshot, orderId: string, ctx: TemplateContext) {
  const emailEnv = getEmailEnv()
  const whatsappEnv = getWhatsAppEnv()

  if (emailEnv.ADMIN_NOTIFICATION_EMAIL) {
    const email = renderAdminNewOrderEmail(order, ctx)
    await recordAndSend(
      {
        channel: "EMAIL",
        template: "ADMIN_NEW_ORDER",
        recipient: emailEnv.ADMIN_NOTIFICATION_EMAIL,
        subject: email.subject,
        orderId,
      },
      () =>
        sendEmail({
          to: emailEnv.ADMIN_NOTIFICATION_EMAIL!,
          subject: email.subject,
          html: email.html,
          text: email.text,
          replyTo: order.email,
        }),
    )
  }

  const adminNumber = normalizeWhatsAppNumber(whatsappEnv.WHATSAPP_ADMIN_NUMBER)
  if (adminNumber) {
    const wa = renderAdminOrderWhatsApp(order, ctx)
    await recordAndSend(
      {
        channel: "WHATSAPP",
        template: "ADMIN_NEW_ORDER",
        recipient: adminNumber,
        orderId,
        payload: { parameters: wa.parameters },
      },
      () =>
        sendWhatsAppMessage({
          to: adminNumber,
          template: getWhatsAppTemplateName("ADMIN_ALERT"),
          parameters: wa.parameters,
          fallbackText: wa.fallbackText,
        }),
    )
  }
}

export async function notifyOrderEvents(orderIds: string[], event: OrderNotificationEvent) {
  for (const orderId of new Set(orderIds)) {
    await notifyOrderEvent(orderId, event)
  }
}

export async function notifyDraftOrdersSent(draftIds: string[]) {
  const prisma = getPrisma()
  const ctx = templateContext()

  for (const draftId of new Set(draftIds)) {
    try {
      const draft = await prisma.draftOrder.findUnique({
        where: { id: draftId },
        select: {
          number: true,
          email: true,
          currency: true,
          subtotal: true,
          discount: true,
          shipping: true,
          total: true,
          user: { select: { id: true, name: true } },
          items: { select: { title: true, sku: true, quantity: true, unitPrice: true, total: true } },
        },
      })
      if (!draft) continue

      const email = renderDraftOrderEmail(
        {
          number: draft.number,
          email: draft.email,
          customerName: draft.user?.name ?? "",
          currency: draft.currency,
          subtotal: Number(draft.subtotal),
          discount: Number(draft.discount),
          shipping: Number(draft.shipping),
          total: Number(draft.total),
          items: draft.items.map((item) => ({
            title: item.title,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            total: Number(item.total),
          })),
        },
        ctx,
      )

      await recordAndSend(
        {
          channel: "EMAIL",
          template: "DRAFT_ORDER_SENT",
          recipient: draft.email,
          subject: email.subject,
          userId: draft.user?.id ?? null,
          payload: { draftId },
        },
        () => sendEmail({ to: draft.email, subject: email.subject, html: email.html, text: email.text }),
      )
    } catch (error) {
      console.error(`[notifications] draft ${draftId} email failed`, error)
    }
  }
}

export async function notifyContactMessage(messageId: string) {
  try {
    const message = await getPrisma().contactMessage.findUnique({ where: { id: messageId } })
    if (!message) return

    const ctx = templateContext()
    const emailEnv = getEmailEnv()
    const adminRecipient = emailEnv.ADMIN_NOTIFICATION_EMAIL ?? ctx.supportEmail

    const adminEmail = renderContactAdminEmail(message, ctx)
    await recordAndSend(
      {
        channel: "EMAIL",
        template: "CONTACT_ADMIN",
        recipient: adminRecipient,
        subject: adminEmail.subject,
        payload: { messageId },
      },
      () =>
        sendEmail({
          to: adminRecipient,
          subject: adminEmail.subject,
          html: adminEmail.html,
          text: adminEmail.text,
          replyTo: message.email,
        }),
    )

    const ack = renderContactAcknowledgementEmail(message, ctx)
    await recordAndSend(
      {
        channel: "EMAIL",
        template: "CONTACT_ACK",
        recipient: message.email,
        subject: ack.subject,
        payload: { messageId },
      },
      () => sendEmail({ to: message.email, subject: ack.subject, html: ack.html, text: ack.text }),
    )
  } catch (error) {
    console.error(`[notifications] contact message ${messageId} failed`, error)
  }
}

export async function sendAuthEmail(
  kind: AuthEmailKind,
  input: { userId: string; email: string; name: string; url: string },
) {
  if (process.env.NODE_ENV !== "production") {
    // Lets you test sign-up / password reset locally without an email provider.
    console.info(`[auth:${kind}] ${input.email} -> ${input.url}`)
  }
  try {
    const email = renderAuthEmail(kind, { name: input.name, url: input.url }, templateContext())
    await recordAndSend(
      {
        channel: "EMAIL",
        template: kind,
        recipient: input.email,
        subject: email.subject,
        userId: input.userId,
      },
      () => sendEmail({ to: input.email, subject: email.subject, html: email.html, text: email.text, bcc: false }),
    )
  } catch (error) {
    console.error(`[notifications] auth email ${kind} failed`, error)
  }
}
