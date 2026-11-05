import "server-only"

import { z } from "zod"

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  /** Neon pooled (PgBouncer) URL for the running app; migrations use DATABASE_URL. */
  DATABASE_URL_POOLED: z.string().trim().optional(),
})

const authEnvSchema = databaseEnvSchema.extend({
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must contain at least 32 characters")
    .refine(
      (value) => !value.startsWith("replace-"),
      "Replace the example BETTER_AUTH_SECRET before starting the application",
    ),
  BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
})

const r2EnvSchema = z.object({
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_PUBLIC_URL: z.url(),
})

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : undefined))
  .optional()

/**
 * Email delivery. Everything is optional: when nothing is configured the
 * notification layer records the message as SKIPPED instead of failing the
 * request that triggered it.
 *
 * - Resend: set RESEND_API_KEY and EMAIL_FROM.
 * - SMTP (Google Workspace, Zoho, Hostinger, etc.): set SMTP_HOST, SMTP_PORT,
 *   SMTP_USER, SMTP_PASSWORD and EMAIL_FROM.
 */
const emailEnvSchema = z.object({
  EMAIL_FROM: optionalString,
  EMAIL_REPLY_TO: optionalString,
  ADMIN_NOTIFICATION_EMAIL: optionalString,
  RESEND_API_KEY: optionalString,
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((value) => value === "true" || value === "1"),
})

/**
 * WhatsApp Cloud API (Meta). Business-initiated messages must use approved
 * message templates, so each event has a template name. When a template name
 * is missing the layer falls back to a plain text message, which Meta only
 * delivers inside an open 24-hour customer service window.
 */
const whatsappEnvSchema = z.object({
  WHATSAPP_PHONE_NUMBER_ID: optionalString,
  WHATSAPP_ACCESS_TOKEN: optionalString,
  WHATSAPP_API_VERSION: z.string().trim().default("v21.0"),
  WHATSAPP_TEMPLATE_LANGUAGE: z.string().trim().default("en"),
  WHATSAPP_ADMIN_NUMBER: optionalString,
  WHATSAPP_TEMPLATE_ORDER_PLACED: optionalString,
  WHATSAPP_TEMPLATE_ORDER_CONFIRMED: optionalString,
  WHATSAPP_TEMPLATE_ORDER_FULFILLED: optionalString,
  WHATSAPP_TEMPLATE_ORDER_CANCELLED: optionalString,
  WHATSAPP_TEMPLATE_ADMIN_ALERT: optionalString,
})

const googleAuthEnvSchema = z.object({
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
})

const razorpayEnvSchema = z.object({
  RAZORPAY_KEY_ID: optionalString,
  RAZORPAY_KEY_SECRET: optionalString,
  RAZORPAY_WEBHOOK_SECRET: optionalString,
  NEXT_PUBLIC_RAZORPAY_KEY_ID: optionalString,
})

const siteEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
  BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
  STORE_NAME: z.string().trim().default("Pubesto"),
  STORE_SUPPORT_EMAIL: z.string().trim().default("support@pubesto.com"),
  ANALYTICS_IP_SALT: optionalString,
})

let databaseEnv: z.infer<typeof databaseEnvSchema> | undefined
let authEnv: z.infer<typeof authEnvSchema> | undefined
let r2Env: z.infer<typeof r2EnvSchema> | undefined
let emailEnv: z.infer<typeof emailEnvSchema> | undefined
let whatsappEnv: z.infer<typeof whatsappEnvSchema> | undefined
let googleAuthEnv: z.infer<typeof googleAuthEnvSchema> | undefined
let razorpayEnv: z.infer<typeof razorpayEnvSchema> | undefined
let siteEnv: z.infer<typeof siteEnvSchema> | undefined

export function getDatabaseEnv() {
  databaseEnv ??= databaseEnvSchema.parse(process.env)
  return databaseEnv
}

export function getAuthEnv() {
  authEnv ??= authEnvSchema.parse(process.env)
  return authEnv
}

export function getR2Env() {
  r2Env ??= r2EnvSchema.parse(process.env)
  return r2Env
}

export function getEmailEnv() {
  emailEnv ??= emailEnvSchema.parse(process.env)
  return emailEnv
}

export function getWhatsAppEnv() {
  whatsappEnv ??= whatsappEnvSchema.parse(process.env)
  return whatsappEnv
}

export function getGoogleAuthEnv() {
  googleAuthEnv ??= googleAuthEnvSchema.parse(process.env)
  return googleAuthEnv
}

export function getRazorpayEnv() {
  razorpayEnv ??= razorpayEnvSchema.parse(process.env)
  return razorpayEnv
}

export function getSiteEnv() {
  siteEnv ??= siteEnvSchema.parse(process.env)
  return siteEnv
}

/** Public origin of the storefront, without a trailing slash. */
export function getSiteUrl() {
  const env = getSiteEnv()
  return (env.NEXT_PUBLIC_SITE_URL ?? env.BETTER_AUTH_URL).replace(/\/$/, "")
}
