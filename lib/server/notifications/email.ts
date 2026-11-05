import "server-only"

import nodemailer from "nodemailer"

import { getEmailEnv } from "@/lib/server/env"

export type EmailMessage = {
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
}

export type DeliveryResult = {
  status: "SENT" | "SKIPPED" | "FAILED"
  providerId?: string
  error?: string
}

type EmailProvider = "resend" | "smtp" | null

function resolveProvider(): EmailProvider {
  const env = getEmailEnv()
  if (!env.EMAIL_FROM) return null
  if (env.RESEND_API_KEY) return "resend"
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD) return "smtp"
  return null
}

export function isEmailConfigured() {
  return resolveProvider() !== null
}

let smtpTransport: nodemailer.Transporter | undefined

function getSmtpTransport() {
  const env = getEmailEnv()
  smtpTransport ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_SECURE || env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
  })
  return smtpTransport
}

async function sendViaResend(message: EmailMessage): Promise<DeliveryResult> {
  const env = getEmailEnv()
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      reply_to: message.replyTo ?? env.EMAIL_REPLY_TO,
    }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    return {
      status: "FAILED",
      error: `Resend responded ${response.status}: ${body.slice(0, 500)}`,
    }
  }

  const payload = (await response.json().catch(() => ({}))) as { id?: string }
  return { status: "SENT", providerId: payload.id }
}

async function sendViaSmtp(message: EmailMessage): Promise<DeliveryResult> {
  const env = getEmailEnv()
  const info = await getSmtpTransport().sendMail({
    from: env.EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    replyTo: message.replyTo ?? env.EMAIL_REPLY_TO,
  })
  return { status: "SENT", providerId: info.messageId }
}

/**
 * Sends one email. Never throws: the caller records the result on the
 * notification log and moves on.
 */
export async function sendEmail(message: EmailMessage): Promise<DeliveryResult> {
  const provider = resolveProvider()

  if (!provider) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[email:skipped] to=${message.to} subject="${message.subject}"`)
    }
    return {
      status: "SKIPPED",
      error: "Email is not configured. Set EMAIL_FROM plus RESEND_API_KEY or SMTP_* variables.",
    }
  }

  try {
    return provider === "resend" ? await sendViaResend(message) : await sendViaSmtp(message)
  } catch (error) {
    return {
      status: "FAILED",
      error: error instanceof Error ? error.message : "Unknown email error",
    }
  }
}
