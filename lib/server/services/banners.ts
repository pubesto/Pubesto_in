import "server-only"

import { assertPermission } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"
import type { BannerInput, BannerPlacement } from "@/lib/validations/banner"

export async function createBanner(input: BannerInput) {
  await assertPermission("banners.manage")
  const prisma = getPrisma()

  let position = input.position
  if (position === 0) {
    const lastBanner = await prisma.banner.findFirst({
      where: { placement: input.placement },
      orderBy: { position: "desc" },
      select: { position: true },
    })
    position = (lastBanner?.position ?? -1) + 1
  }

  return prisma.banner.create({
    data: {
      title: input.title,
      subtitle: input.subtitle,
      desktopImageKey: input.desktopImageKey,
      mobileImageKey: input.mobileImageKey,
      ctaText: input.ctaText,
      ctaLink: input.ctaLink,
      placement: input.placement,
      textAlignment: input.textAlignment,
      overlayOpacity: input.overlayOpacity,
      desktopFocus: input.desktopFocus ?? null,
      mobileFocus: input.mobileFocus ?? null,
      isActive: input.isActive,
      position,
    },
  })
}

export async function updateBanner(id: string, input: BannerInput) {
  await assertPermission("banners.manage")
  const prisma = getPrisma()

  const existing = await prisma.banner.findUnique({
    where: { id },
  })

  if (!existing) {
    throw new Error("Banner not found.")
  }

  return prisma.banner.update({
    where: { id },
    data: {
      title: input.title,
      subtitle: input.subtitle,
      desktopImageKey: input.desktopImageKey,
      mobileImageKey: input.mobileImageKey,
      ctaText: input.ctaText,
      ctaLink: input.ctaLink,
      placement: input.placement,
      textAlignment: input.textAlignment,
      overlayOpacity: input.overlayOpacity,
      desktopFocus: input.desktopFocus ?? null,
      mobileFocus: input.mobileFocus ?? null,
      isActive: input.isActive,
      position: input.position,
    },
  })
}

export async function updateBannerActive(id: string, isActive: boolean) {
  await assertPermission("banners.manage")
  const prisma = getPrisma()

  const banner = await prisma.banner.findUnique({ where: { id } })
  if (!banner) {
    throw new Error("Banner not found.")
  }

  return prisma.banner.update({
    where: { id },
    data: { isActive },
  })
}

export async function deleteBanners(ids: string[]) {
  await assertPermission("banners.delete")
  const prisma = getPrisma()

  return prisma.banner.deleteMany({
    where: { id: { in: ids } },
  })
}

export async function reorderBanners(items: { id: string; position: number }[]) {
  await assertPermission("banners.manage")
  const prisma = getPrisma()

  return prisma.$transaction(
    items.map((item) =>
      prisma.banner.update({
        where: { id: item.id },
        data: { position: item.position },
      }),
    ),
  )
}

export type StoredBannerImage = {
  key: string
  url: string
  size: number
  lastModified: string
  inUseBy: {
    id: string
    title: string | null
    role: "desktop" | "mobile"
    placement: BannerPlacement
  }[]
}

export async function listStoredBannerImages(): Promise<StoredBannerImage[]> {
  await assertPermission("banners.view")
  const prisma = getPrisma()

  // 1. Get all banners to know which images are currently in use
  const activeBanners = await prisma.banner.findMany({
    select: {
      id: true,
      title: true,
      placement: true,
      desktopImageKey: true,
      mobileImageKey: true,
    },
  })

  const inUseMap = new Map<
    string,
    {
      id: string
      title: string | null
      role: "desktop" | "mobile"
      placement: BannerPlacement
    }[]
  >()
  for (const b of activeBanners) {
    if (b.desktopImageKey) {
      const list = inUseMap.get(b.desktopImageKey) || []
      list.push({
        id: b.id,
        title: b.title,
        role: "desktop",
        placement: b.placement as BannerPlacement,
      })
      inUseMap.set(b.desktopImageKey, list)
    }
    if (b.mobileImageKey) {
      const list = inUseMap.get(b.mobileImageKey) || []
      list.push({
        id: b.id,
        title: b.title,
        role: "mobile",
        placement: b.placement as BannerPlacement,
      })
      inUseMap.set(b.mobileImageKey, list)
    }
  }

  const itemsMap = new Map<string, StoredBannerImage>()

  // 2. Query Cloudflare R2
  try {
    const { ListObjectsV2Command } = await import("@aws-sdk/client-s3")
    const { getR2Env } = await import("@/lib/server/env")
    const { getR2Client } = await import("@/lib/server/r2")

    const env = getR2Env()
    const r2 = getR2Client()
    const response = await r2.send(
      new ListObjectsV2Command({
        Bucket: env.R2_BUCKET_NAME,
        Prefix: "banners/",
        MaxKeys: 250,
      }),
    )

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (!obj.Key || obj.Key.endsWith("/")) continue
        const publicUrl = `${env.R2_PUBLIC_URL.replace(/\/$/, "")}/${obj.Key}`
        itemsMap.set(obj.Key, {
          key: obj.Key,
          url: publicUrl,
          size: obj.Size ?? 0,
          lastModified: obj.LastModified?.toISOString() ?? new Date().toISOString(),
          inUseBy: inUseMap.get(obj.Key) || [],
        })
      }
    }
  } catch (err) {
    console.error("Error listing banners from Cloudflare R2:", err)
  }

  // 3. Scan local development directory if present
  try {
    const { readdir, stat } = await import("node:fs/promises")
    const { join, resolve } = await import("node:path")

    const localDir = resolve(process.cwd(), "public", "uploads", "banners")
    const scanDir = async (dir: string, baseRelative: string) => {
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        const relPath = baseRelative ? `${baseRelative}/${entry.name}` : entry.name
        if (entry.isDirectory()) {
          await scanDir(fullPath, relPath)
        } else if (/\.(?:avif|jpg|jpeg|png|webp)$/i.test(entry.name)) {
          const fileStat = await stat(fullPath)
          const key = `uploads/banners/${relPath}`
          itemsMap.set(key, {
            key,
            url: `/${key}`,
            size: fileStat.size,
            lastModified: fileStat.mtime.toISOString(),
            inUseBy: inUseMap.get(key) || [],
          })
        }
      }
    }
    await scanDir(localDir, "")
  } catch {
    // Local directory not created yet
  }

  return Array.from(itemsMap.values()).sort(
    (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime(),
  )
}

export async function deleteStoredBannerImage(key: string) {
  await assertPermission("banners.delete")
  const prisma = getPrisma()

  // 1. Delete from Cloudflare R2
  if (key.startsWith("banners/")) {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3")
    const { getR2Env } = await import("@/lib/server/env")
    const { getR2Client } = await import("@/lib/server/r2")

    const env = getR2Env()
    const r2 = getR2Client()
    await r2.send(
      new DeleteObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
      }),
    )
  } else if (key.startsWith("uploads/banners/")) {
    const { unlink } = await import("node:fs/promises")
    const { resolve } = await import("node:path")

    const filePath = resolve(process.cwd(), "public", key)
    const publicDirectory = resolve(process.cwd(), "public", "uploads", "banners")
    if (filePath.startsWith(publicDirectory)) {
      await unlink(filePath).catch(() => {})
    }
  }

  // 2. Clean up any banner records using this image key
  await prisma.banner.updateMany({
    where: { desktopImageKey: key },
    data: { desktopImageKey: "/home-page-content/hero-1.png" },
  })

  await prisma.banner.updateMany({
    where: { mobileImageKey: key },
    data: { mobileImageKey: null },
  })

  return { success: true }
}

