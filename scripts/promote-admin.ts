import "dotenv/config"

import { PrismaPg } from "@prisma/adapter-pg"
import { z } from "zod"

import { PrismaClient } from "../generated/prisma/client"
import { ALL_PERMISSION_KEYS, normalizePermissions } from "../lib/permissions"

/**
 * Change a user's role (and, for sub-admins, their permissions).
 *
 *   ADMIN_EMAIL=owner@example.com npm run admin:promote                 -> ADMIN
 *   ADMIN_EMAIL=staff@example.com ADMIN_ROLE=SUB_ADMIN \
 *     ADMIN_PERMISSIONS=orders.view,orders.manage,products.view npm run admin:promote
 *   ADMIN_EMAIL=staff@example.com ADMIN_ROLE=CUSTOMER npm run admin:promote -> revoke
 *
 * The dashboard page at /dashboard/settings/staff does the same thing with a UI.
 */
const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    ADMIN_EMAIL: z.email(),
    ADMIN_ROLE: z.enum(["ADMIN", "SUB_ADMIN", "CUSTOMER"]).default("ADMIN"),
    ADMIN_PERMISSIONS: z
      .string()
      .optional()
      .transform((value) =>
        value
          ? value
              .split(",")
              .map((part) => part.trim())
              .filter(Boolean)
          : [],
      ),
  })
  .parse(process.env)

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  connectionTimeoutMillis: 5_000,
  max: 1,
})
const prisma = new PrismaClient({ adapter })

async function main() {
  try {
    const unknown = env.ADMIN_PERMISSIONS.filter(
      (key) => !(ALL_PERMISSION_KEYS as string[]).includes(key),
    )
    if (unknown.length) {
      console.warn(`Ignoring unknown permissions: ${unknown.join(", ")}`)
      console.warn(`Known permissions: ${ALL_PERMISSION_KEYS.join(", ")}`)
    }

    const permissions =
      env.ADMIN_ROLE === "SUB_ADMIN" ? normalizePermissions(env.ADMIN_PERMISSIONS) : []

    const user = await prisma.user.update({
      where: { email: env.ADMIN_EMAIL.toLowerCase() },
      data: { role: env.ADMIN_ROLE, permissions },
      select: { id: true, email: true, role: true, permissions: true },
    })

    console.log(
      `Updated ${user.email} (${user.id}) to ${user.role}${
        user.role === "SUB_ADMIN" ? ` with [${user.permissions.join(", ")}]` : ""
      }.`,
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
