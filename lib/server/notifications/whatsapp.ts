import "server-only"

import { getWhatsAppEnv } from "@/lib/server/env"

import type { DeliveryResult } from "./email"

export type WhatsAppTemplateMessage = {
  to: string
  /** Approved template name in the Meta Business Manager. */
  template?: string
  /** Positional {{1}}, {{2}}… body parameters, in order. */
  parameters: string[]
  /** Plain-text fallback used when no template is configured. */
  fallbackText: string
}

/**
 * Normalises an Indian or international phone number to E.164 digits without
 * the plus sign, which is what the Cloud API expects.
 */
export function normalizeWhatsAppNumber(input: string | null | undefined): string | null {
  if (!input) return null
  let digits = input.replace(/\D/g, "")
  if (!digits) return null
  if (digits.startsWith("00")) digits = digits.slice(2)
  if (digits.length === 10) digits = `91${digits}`
  if (digits.length === 11 && digits.startsWith("0")) digits = `91${digits.slice(1)}`
  if (digits.length < 11 || digits.length > 15) return null
  return digits
}

export function isWhatsAppConfigured() {
  const env = getWhatsAppEnv()
  return Boolean(env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN)
}

export function getWhatsAppTemplateName(
  key:
    | "ORDER_PLACED"
    | "ORDER_CONFIRMED"
    | "ORDER_FULFILLED"
    | "ORDER_CANCELLED"
    | "ADMIN_ALERT",
) {
  const env = getWhatsAppEnv()
  switch (key) {
    case "ORDER_PLACED":
      return env.WHATSAPP_TEMPLATE_ORDER_PLACED
    case "ORDER_CONFIRMED":
      return env.WHATSAPP_TEMPLATE_ORDER_CONFIRMED
    case "ORDER_FULFILLED":
      return env.WHATSAPP_TEMPLATE_ORDER_FULFILLED
    case "ORDER_CANCELLED":
      return env.WHATSAPP_TEMPLATE_ORDER_CANCELLED
    case "ADMIN_ALERT":
      return env.WHATSAPP_TEMPLATE_ADMIN_ALERT
  }
}

/**
 * Sends one WhatsApp message through the Meta Cloud API. Never throws.
 */
export async function sendWhatsAppMessage(
  message: WhatsAppTemplateMessage,
): Promise<DeliveryResult> {
  const env = getWhatsAppEnv()

  if (!env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_ACCESS_TOKEN) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[whatsapp:skipped] to=${message.to} template=${message.template ?? "text"}`)
    }
    return {
      status: "SKIPPED",
      error:
        "WhatsApp is not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.",
    }
  }

  const to = normalizeWhatsAppNumber(message.to)
  if (!to) {
    return { status: "SKIPPED", error: `Invalid phone number: ${message.to}` }
  }

  const body = message.template
    ? {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: message.template,
          language: { code: env.WHATSAPP_TEMPLATE_LANGUAGE },
          components: message.parameters.length
            ? [
                {
                  type: "body",
                  parameters: message.parameters.map((text) => ({
                    type: "text",
                    text: text.slice(0, 1024),
                  })),
                },
              ]
            : [],
        },
      }
    : {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { preview_url: false, body: message.fallbackText.slice(0, 4096) },
      }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      },
    )

    const payload = (await response.json().catch(() => ({}))) as {
      messages?: Array<{ id: string }>
      error?: { message?: string; code?: number }
    }

    if (!response.ok) {
      return {
        status: "FAILED",
        error: payload.error?.message
          ? `Meta ${payload.error.code ?? response.status}: ${payload.error.message}`
          : `WhatsApp API responded ${response.status}`,
      }
    }

    return { status: "SENT", providerId: payload.messages?.[0]?.id }
  } catch (error) {
    return {
      status: "FAILED",
      error: error instanceof Error ? error.message : "Unknown WhatsApp error",
    }
  }
}
