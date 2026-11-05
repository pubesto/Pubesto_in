import "server-only"

import { cache } from "react"

import { isVideoMedia } from "@/lib/banner-media"
import { getPrisma } from "@/lib/server/db"
import { mediaUrl } from "@/lib/server/media"

/** A homepage hero slide, in the shape app/(store)/page.jsx renders. */
export type StorefrontHeroSlide = {
  id: string
  eyebrow: string
  title: string
  copy: string
  cta: string
  link: string
  image: string
  mobileImage: string | null
  video: string | null
}

/**
 * Active HERO banners from Dashboard → Banners. Empty when none are active,
 * in which case the homepage falls back to its built-in slides.
 */
export const getHeroSlides = cache(async (): Promise<StorefrontHeroSlide[]> => {
  try {
    const banners = await getPrisma().banner.findMany({
      where: { placement: "HERO", isActive: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      take: 8,
    })
    return banners.map((banner) => {
      const desktop = mediaUrl(banner.desktopImageKey) ?? ""
      const mobile = mediaUrl(banner.mobileImageKey)
      const video = isVideoMedia(desktop) ? desktop : null
      return {
        id: banner.id,
        eyebrow: "",
        title: banner.title ?? "",
        copy: banner.subtitle ?? "",
        cta: banner.ctaText || "Shop now",
        link: banner.ctaLink || "/shop",
        image: video ? (mobile ?? "") : desktop,
        mobileImage: mobile,
        video,
      }
    })
  } catch (error) {
    console.error("[storefront] failed to load hero banners", error)
    return []
  }
})
