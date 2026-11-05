import "server-only"

import { cache } from "react"

import type { Prisma } from "@/generated/prisma/client"
import { assertPermission, requirePermission } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"
import {
  DEFAULT_SITE_CONTENT,
  SITE_CONTENT_KEYS,
  type SiteContent,
  type SiteContentKey,
} from "@/lib/site-content"
import { siteContentSchemas } from "@/lib/validations/site-content"

function parseStored<K extends SiteContentKey>(key: K, value: unknown): SiteContent[K] | null {
  const schema = siteContentSchemas[key]
  const result = schema.safeParse(value)
  return result.success ? (result.data as SiteContent[K]) : null
}

/**
 * Storefront content: database overrides merged over the code defaults. One
 * query per request thanks to React's cache; a database outage falls back to
 * the defaults so the storefront never breaks because of the CMS.
 */
export const getSiteContent = cache(async (): Promise<SiteContent> => {
  const content: SiteContent = structuredClone(DEFAULT_SITE_CONTENT)

  try {
    const rows = await getPrisma().siteContent.findMany({
      select: { key: true, value: true },
    })
    for (const row of rows) {
      if (!(SITE_CONTENT_KEYS as string[]).includes(row.key)) continue
      const key = row.key as SiteContentKey
      const parsed = parseStored(key, row.value)
      if (parsed) {
        ;(content as Record<string, unknown>)[key] = parsed
      }
    }
  } catch (error) {
    console.error("[site-content] falling back to defaults", error)
  }

  return content
})

export type SiteContentAdminView = {
  content: SiteContent
  overrides: Record<SiteContentKey, { updatedAt: string; updatedBy: string | null } | null>
}

export async function getSiteContentForAdmin(): Promise<SiteContentAdminView> {
  await requirePermission("content.view")
  const [content, rows] = await Promise.all([
    getSiteContent(),
    getPrisma().siteContent.findMany({ select: { key: true, updatedAt: true, updatedById: true } }),
  ])

  const userIds = rows.map((row) => row.updatedById).filter((id): id is string => Boolean(id))
  const users = userIds.length
    ? await getPrisma().user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : []
  const nameById = new Map(users.map((user) => [user.id, user.name]))

  const overrides = Object.fromEntries(
    SITE_CONTENT_KEYS.map((key) => {
      const row = rows.find((entry) => entry.key === key)
      return [
        key,
        row
          ? { updatedAt: row.updatedAt.toISOString(), updatedBy: row.updatedById ? nameById.get(row.updatedById) ?? null : null }
          : null,
      ]
    }),
  ) as SiteContentAdminView["overrides"]

  return { content, overrides }
}

export async function saveSiteContentSection<K extends SiteContentKey>(key: K, value: SiteContent[K]) {
  const user = await assertPermission("content.manage")
  await getPrisma().siteContent.upsert({
    where: { key },
    create: { key, value: value as Prisma.InputJsonValue, updatedById: user.id },
    update: { value: value as Prisma.InputJsonValue, updatedById: user.id },
  })
}

export async function resetSiteContentSection(key: SiteContentKey) {
  await assertPermission("content.manage")
  await getPrisma().siteContent.deleteMany({ where: { key } })
}
