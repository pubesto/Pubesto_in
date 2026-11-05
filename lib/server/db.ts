import "server-only"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "@/generated/prisma/client"
import { getDatabaseEnv } from "@/lib/server/env"

const SCHEMA_VERSION = "2026-10-08-v3-notifications-analytics"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  schemaVersion?: string
}

if (globalForPrisma.schemaVersion !== SCHEMA_VERSION) {
  globalForPrisma.prisma = undefined
  globalForPrisma.schemaVersion = SCHEMA_VERSION
}

let prisma = globalForPrisma.prisma

function createPrismaClient() {
  const { DATABASE_URL, DATABASE_URL_POOLED } = getDatabaseEnv()
  const adapter = new PrismaPg({
    // Neon: serve requests through the pooler; Prisma migrations use the direct URL.
    connectionString: DATABASE_URL_POOLED || DATABASE_URL,
    // Neon computes scale to zero; the first connection after idle can take a few seconds.
    connectionTimeoutMillis: 15_000,
    max: 10,
  })

  return new PrismaClient({ adapter })
}

export function getPrisma() {
  if (!prisma || !("notification" in prisma)) {
    prisma = createPrismaClient()
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = prisma
    }
  }

  return prisma
}
