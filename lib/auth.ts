import "server-only"

import { prismaAdapter } from "@better-auth/prisma-adapter"
import { betterAuth } from "better-auth/minimal"

import { getPrisma } from "@/lib/server/db"
import { getAuthEnv, getGoogleAuthEnv } from "@/lib/server/env"
import { sendAuthEmail } from "@/lib/server/notifications"

function createAuth() {
  const authEnv = getAuthEnv()
  const googleEnv = getGoogleAuthEnv()
  const googleConfigured = Boolean(googleEnv.GOOGLE_CLIENT_ID && googleEnv.GOOGLE_CLIENT_SECRET)

  return betterAuth({
    appName: "Pubesto",
    baseURL: authEnv.BETTER_AUTH_URL,
    secret: authEnv.BETTER_AUTH_SECRET,
    trustedOrigins: [
      authEnv.BETTER_AUTH_URL,
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:*",
      "http://127.0.0.1:*",
      "https://*.pubesto.com",
      "https://pubesto.com",
      "https://www.pubesto.com",
    ],
    database: prismaAdapter(getPrisma(), {
      provider: "postgresql",
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      sendResetPassword: async ({ user, url }) => {
        await sendAuthEmail("PASSWORD_RESET", {
          userId: user.id,
          email: user.email,
          name: user.name,
          url,
        })
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendAuthEmail("VERIFY_EMAIL", {
          userId: user.id,
          email: user.email,
          name: user.name,
          url,
        })
      },
    },
    ...(googleConfigured
      ? {
          socialProviders: {
            google: {
              clientId: googleEnv.GOOGLE_CLIENT_ID!,
              clientSecret: googleEnv.GOOGLE_CLIENT_SECRET!,
              // Same redirect URI the old login used, so the Google Cloud
              // console needs no change (app/api/auth/google/callback forwards here).
              redirectURI: `${authEnv.BETTER_AUTH_URL.replace(/\/$/, "")}/api/auth/google/callback`,
              prompt: "select_account",
            },
          },
        }
      : {}),
    account: {
      accountLinking: {
        enabled: true,
        // Customers imported from Shopify have verified emails, so signing in
        // with Google attaches to their existing account and order history.
        trustedProviders: ["google"],
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    user: {
      additionalFields: {
        role: {
          type: ["CUSTOMER", "SUB_ADMIN", "ADMIN"],
          defaultValue: "CUSTOMER",
          input: false,
          required: true,
        },
        phone: {
          type: "string",
          required: false,
          input: true,
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            try {
              const prisma = getPrisma()
              await prisma.order.updateMany({
                where: { email: { equals: user.email, mode: "insensitive" }, userId: null },
                data: { userId: user.id },
              })
            } catch (err) {
              console.error("[auth] failed linking guest orders to user", err)
            }
          },
        },
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
    },
  })
}

export type Auth = ReturnType<typeof createAuth>

let auth: Auth | undefined

export function getAuth() {
  auth ??= createAuth()
  return auth
}
