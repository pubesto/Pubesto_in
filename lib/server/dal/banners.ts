import "server-only"

import { requirePermission } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"
import type { BannerPlacement, BannerTextAlignment } from "@/lib/validations/banner"

function imageUrl(objectKey: string | null | undefined): string | null {
  if (!objectKey) return null
  if (objectKey.startsWith("http://") || objectKey.startsWith("https://")) {
    return objectKey
  }
  if (objectKey.startsWith("/")) {
    return objectKey
  }
  if (objectKey.startsWith("uploads/")) {
    return `/${objectKey}`
  }
  const baseUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "")
  return baseUrl ? `${baseUrl}/${objectKey}` : `/${objectKey}`
}

export type AdminBannerListItem = {
  id: string
  title: string | null
  subtitle: string | null
  desktopImageUrl: string
  desktopImageKey: string
  mobileImageUrl: string | null
  /** Crop focus (CSS object-position); null = centre. */
  desktopFocus?: string | null
  mobileFocus?: string | null
  mobileImageKey: string | null
  ctaText: string | null
  ctaLink: string | null
  placement: BannerPlacement
  textAlignment: BannerTextAlignment
  overlayOpacity: number
  isActive: boolean
  position: number
  updatedAt: string
}

export type AdminBannerDetail = {
  id: string
  title: string | null
  subtitle: string | null
  desktopImageKey: string
  desktopImageUrl: string
  mobileImageKey: string | null
  mobileImageUrl: string | null
  /** Crop focus (CSS object-position); null = centre. */
  desktopFocus?: string | null
  mobileFocus?: string | null
  ctaText: string | null
  ctaLink: string | null
  placement: BannerPlacement
  textAlignment: BannerTextAlignment
  overlayOpacity: number
  isActive: boolean
  position: number
}

export type HomeHeroBanner = {
  id: string
  title: string | null
  subtitle: string | null
  desktopImageUrl: string
  mobileImageUrl: string | null
  /** Crop focus (CSS object-position); null = centre. */
  desktopFocus?: string | null
  mobileFocus?: string | null
  ctaText: string | null
  ctaLink: string | null
  textAlignment: BannerTextAlignment
  overlayOpacity: number
}

export type HomeBannerSectionItem = {
  id: string
  title: string | null
  subtitle: string | null
  desktopImageUrl: string
  mobileImageUrl: string | null
  /** Crop focus (CSS object-position); null = centre. */
  desktopFocus?: string | null
  mobileFocus?: string | null
  ctaText: string | null
  ctaLink: string | null
  overlayOpacity: number
}

export type HomeEditorialBanner = {
  id: string
  title: string | null
  subtitle: string | null
  desktopImageUrl: string
  mobileImageUrl: string | null
  /** Crop focus (CSS object-position); null = centre. */
  desktopFocus?: string | null
  mobileFocus?: string | null
  ctaText: string | null
  ctaLink: string | null
  position: number
}

export type HomeCarouselSlide = {
  id: string
  title: string | null
  subtitle: string | null
  desktopImageUrl: string
  mobileImageUrl: string | null
  /** Crop focus (CSS object-position); null = centre. */
  desktopFocus?: string | null
  mobileFocus?: string | null
  ctaText: string | null
  ctaLink: string | null
  position: number
}

export type HomeBanners = {
  hero: HomeHeroBanner[]
  /** Two side-by-side images directly below the hero (slot 0 left, slot 1 right). */
  split: HomeEditorialBanner[]
  /** Full-width image/video banner directly below Our Favourite. */
  feature: HomeBannerSectionItem | null
  middle: HomeBannerSectionItem | null
  bottom: HomeBannerSectionItem | null
  editorial: HomeEditorialBanner[]
  denimCarousel: HomeCarouselSlide[]
}

export async function listBannersForAdmin(): Promise<AdminBannerListItem[]> {
  await requirePermission("banners.view")
  const prisma = getPrisma()

  if (!prisma || !("banner" in prisma) || !prisma.banner) {
    return []
  }

  const banners = await prisma.banner.findMany({
    orderBy: [
      { placement: "asc" },
      { position: "asc" },
      { createdAt: "desc" },
    ],
  })

  return banners.map((banner) => ({
    id: banner.id,
    title: banner.title,
    subtitle: banner.subtitle,
    desktopImageUrl: imageUrl(banner.desktopImageKey) ?? banner.desktopImageKey,
    desktopImageKey: banner.desktopImageKey,
    mobileImageUrl: imageUrl(banner.mobileImageKey),
    desktopFocus: banner.desktopFocus,
    mobileFocus: banner.mobileFocus,
    mobileImageKey: banner.mobileImageKey,
    ctaText: banner.ctaText,
    ctaLink: banner.ctaLink,
    placement: banner.placement as BannerPlacement,
    textAlignment: banner.textAlignment as BannerTextAlignment,
    overlayOpacity: banner.overlayOpacity,
    isActive: banner.isActive,
    position: banner.position,
    updatedAt: banner.updatedAt.toISOString(),
  }))
}

export async function listHeroSlidesForAdmin(): Promise<AdminBannerListItem[]> {
  await requirePermission("banners.view")
  const prisma = getPrisma()

  if (!prisma || !("banner" in prisma) || !prisma.banner) {
    return []
  }

  const banners = await prisma.banner.findMany({
    where: { placement: "HERO" },
    orderBy: [
      { position: "asc" },
      { createdAt: "asc" },
    ],
  })

  return banners.map((banner) => ({
    id: banner.id,
    title: banner.title,
    subtitle: banner.subtitle,
    desktopImageUrl: imageUrl(banner.desktopImageKey) ?? banner.desktopImageKey,
    desktopImageKey: banner.desktopImageKey,
    mobileImageUrl: imageUrl(banner.mobileImageKey),
    desktopFocus: banner.desktopFocus,
    mobileFocus: banner.mobileFocus,
    mobileImageKey: banner.mobileImageKey,
    ctaText: banner.ctaText,
    ctaLink: banner.ctaLink,
    placement: banner.placement as BannerPlacement,
    textAlignment: banner.textAlignment as BannerTextAlignment,
    overlayOpacity: banner.overlayOpacity,
    isActive: banner.isActive,
    position: banner.position,
    updatedAt: banner.updatedAt.toISOString(),
  }))
}

export async function getBannerForAdmin(id: string): Promise<AdminBannerDetail | null> {
  await requirePermission("banners.view")
  const prisma = getPrisma()

  if (!prisma || !("banner" in prisma) || !prisma.banner) {
    return null
  }

  const banner = await prisma.banner.findUnique({
    where: { id },
  })

  if (!banner) return null

  return {
    id: banner.id,
    title: banner.title,
    subtitle: banner.subtitle,
    desktopImageKey: banner.desktopImageKey,
    desktopImageUrl: imageUrl(banner.desktopImageKey) ?? banner.desktopImageKey,
    mobileImageKey: banner.mobileImageKey,
    mobileImageUrl: imageUrl(banner.mobileImageKey),
    desktopFocus: banner.desktopFocus,
    mobileFocus: banner.mobileFocus,
    ctaText: banner.ctaText,
    ctaLink: banner.ctaLink,
    placement: banner.placement as BannerPlacement,
    textAlignment: banner.textAlignment as BannerTextAlignment,
    overlayOpacity: banner.overlayOpacity,
    isActive: banner.isActive,
    position: banner.position,
  }
}

export async function getHomeBanners(): Promise<HomeBanners> {
  const defaultFallback: HomeBanners = {
    hero: [
      {
        id: "default-hero",
        title: null,
        subtitle: null,
        desktopImageUrl: "/home-page-content/hero-1.png",
        mobileImageUrl: "/home-page-content/hero-mobile.jpg",
        ctaText: "EXPLORE COLLECTION",
        ctaLink: "/collections",
        textAlignment: "CENTER",
        overlayOpacity: 15,
      },
    ],
    // Hidden until SPLIT images are uploaded in admin.
    split: [],
    // Hidden until a FEATURE banner (image or video) is uploaded in admin.
    feature: null,
    middle: {
      id: "default-middle",
      title: null,
      subtitle: null,
      desktopImageUrl: "/home-page-content/hero-2.png",
      mobileImageUrl: null,
      ctaText: null,
      ctaLink: "/collections",
      overlayOpacity: 0,
    },
    bottom: {
      id: "default-bottom",
      title: null,
      subtitle: null,
      desktopImageUrl: "/images/products/product15.png",
      mobileImageUrl: null,
      ctaText: null,
      ctaLink: "/collections",
      overlayOpacity: 0,
    },
    editorial: [
      {
        id: "default-editorial-0",
        title: "Model sitting in a denim set on a chair",
        subtitle: null,
        desktopImageUrl: "/images/products/product6.png",
        mobileImageUrl: null,
        ctaText: null,
        ctaLink: "/collections",
        position: 0,
      },
      {
        id: "default-editorial-1",
        title: "Model sitting in denim beside greenery",
        subtitle: null,
        desktopImageUrl: "/images/products/product7.png",
        mobileImageUrl: null,
        ctaText: null,
        ctaLink: "/collections",
        position: 1,
      },
      {
        id: "default-editorial-2",
        title: "Model reclining in a denim look across stacked screens",
        subtitle: null,
        desktopImageUrl: "/images/products/product8.png",
        mobileImageUrl: null,
        ctaText: null,
        ctaLink: "/collections",
        position: 2,
      },
    ],
    denimCarousel: [
      {
        id: "default-slide-skinny",
        title: "Model wearing skinny denim",
        subtitle: "Skinny",
        desktopImageUrl: "/images/products/product5-white.png",
        mobileImageUrl: null,
        ctaText: null,
        ctaLink: "/collections",
        position: 0,
      },
      {
        id: "default-slide-bootcut",
        title: "Model wearing bootcut denim",
        subtitle: "Bootcut",
        desktopImageUrl: "/images/products/product5-white.png",
        mobileImageUrl: null,
        ctaText: null,
        ctaLink: "/collections",
        position: 1,
      },
      {
        id: "default-slide-low-rise",
        title: "Model wearing low-rise denim",
        subtitle: "Low-Rise",
        desktopImageUrl: "/images/products/product5-white.png",
        mobileImageUrl: null,
        ctaText: null,
        ctaLink: "/collections",
        position: 2,
      },
      {
        id: "default-slide-straight",
        title: "Model wearing straight denim",
        subtitle: "Straight",
        desktopImageUrl: "/images/products/product5-white.png",
        mobileImageUrl: null,
        ctaText: null,
        ctaLink: "/collections",
        position: 3,
      },
      {
        id: "default-slide-relaxed",
        title: "Model wearing relaxed denim",
        subtitle: "Relaxed",
        desktopImageUrl: "/images/products/product5-white.png",
        mobileImageUrl: null,
        ctaText: null,
        ctaLink: "/collections",
        position: 4,
      },
    ],
  }

  try {
    const prisma = getPrisma()

    if (!prisma || !("banner" in prisma) || !prisma.banner) {
      return defaultFallback
    }

    const activeBanners = await prisma.banner.findMany({
      where: { isActive: true },
      orderBy: { position: "asc" },
    })

    const heroBanners = activeBanners.filter((b) => b.placement === "HERO")
    const splitBanners = activeBanners.filter((b) => b.placement === "SPLIT")
    const featureBanners = activeBanners.filter((b) => b.placement === "FEATURE")
    const middleBanners = activeBanners.filter((b) => b.placement === "MIDDLE")
    const bottomBanners = activeBanners.filter((b) => b.placement === "BOTTOM")
    const editorialBanners = activeBanners.filter((b) => b.placement === "EDITORIAL")
    const denimCarouselBanners = activeBanners.filter((b) => b.placement === "DENIM_CAROUSEL")

    const hero: HomeHeroBanner[] =
      heroBanners.length > 0
        ? heroBanners.map((b) => ({
            id: b.id,
            title: b.title,
            subtitle: b.subtitle,
            desktopImageUrl: imageUrl(b.desktopImageKey) ?? b.desktopImageKey,
            mobileImageUrl: imageUrl(b.mobileImageKey),
            desktopFocus: b.desktopFocus,
            mobileFocus: b.mobileFocus,
            ctaText: b.ctaText,
            ctaLink: b.ctaLink,
            textAlignment: (b.textAlignment as BannerTextAlignment) || "CENTER",
            overlayOpacity: b.overlayOpacity,
          }))
        : defaultFallback.hero

    const split: HomeEditorialBanner[] = splitBanners.map((b) => ({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle,
      desktopImageUrl: imageUrl(b.desktopImageKey) ?? b.desktopImageKey,
      mobileImageUrl: imageUrl(b.mobileImageKey),
      desktopFocus: b.desktopFocus,
      mobileFocus: b.mobileFocus,
      ctaText: b.ctaText,
      ctaLink: b.ctaLink,
      position: b.position,
    }))

    const hasConfiguredBanners = activeBanners.length > 0
    const featureBanner = featureBanners[0]
    const feature: HomeBannerSectionItem | null = featureBanner
      ? {
          id: featureBanner.id,
          title: featureBanner.title,
          subtitle: featureBanner.subtitle,
          desktopImageUrl: imageUrl(featureBanner.desktopImageKey) ?? featureBanner.desktopImageKey,
          mobileImageUrl: imageUrl(featureBanner.mobileImageKey),
          desktopFocus: featureBanner.desktopFocus,
          mobileFocus: featureBanner.mobileFocus,
          ctaText: featureBanner.ctaText,
          ctaLink: featureBanner.ctaLink,
          overlayOpacity: featureBanner.overlayOpacity,
        }
      : null
    const middleBanner = middleBanners[0]
    const middle: HomeBannerSectionItem | null = middleBanner
      ? {
          id: middleBanner.id,
          title: middleBanner.title,
          subtitle: middleBanner.subtitle,
          desktopImageUrl: imageUrl(middleBanner.desktopImageKey) ?? middleBanner.desktopImageKey,
          mobileImageUrl: imageUrl(middleBanner.mobileImageKey),
          desktopFocus: middleBanner.desktopFocus,
          mobileFocus: middleBanner.mobileFocus,
          ctaText: middleBanner.ctaText,
          ctaLink: middleBanner.ctaLink,
          overlayOpacity: middleBanner.overlayOpacity,
        }
      : hasConfiguredBanners ? null : defaultFallback.middle

    const bottomBanner = bottomBanners[0]
    const bottom: HomeBannerSectionItem | null = bottomBanner
      ? {
          id: bottomBanner.id,
          title: bottomBanner.title,
          subtitle: bottomBanner.subtitle,
          desktopImageUrl: imageUrl(bottomBanner.desktopImageKey) ?? bottomBanner.desktopImageKey,
          mobileImageUrl: imageUrl(bottomBanner.mobileImageKey),
          desktopFocus: bottomBanner.desktopFocus,
          mobileFocus: bottomBanner.mobileFocus,
          ctaText: bottomBanner.ctaText,
          ctaLink: bottomBanner.ctaLink,
          overlayOpacity: bottomBanner.overlayOpacity,
        }
      : hasConfiguredBanners ? null : defaultFallback.bottom

    const editorial: HomeEditorialBanner[] =
      editorialBanners.length > 0
        ? editorialBanners.map((b) => ({
            id: b.id,
            title: b.title,
            subtitle: b.subtitle,
            desktopImageUrl: imageUrl(b.desktopImageKey) ?? b.desktopImageKey,
            mobileImageUrl: imageUrl(b.mobileImageKey),
            desktopFocus: b.desktopFocus,
            mobileFocus: b.mobileFocus,
            ctaText: b.ctaText,
            ctaLink: b.ctaLink,
            position: b.position,
          }))
        : defaultFallback.editorial

    const denimCarousel: HomeCarouselSlide[] =
      denimCarouselBanners.length > 0
        ? denimCarouselBanners.map((b) => ({
            id: b.id,
            title: b.title,
            subtitle: b.subtitle,
            desktopImageUrl: imageUrl(b.desktopImageKey) ?? b.desktopImageKey,
            mobileImageUrl: imageUrl(b.mobileImageKey),
            desktopFocus: b.desktopFocus,
            mobileFocus: b.mobileFocus,
            ctaText: b.ctaText,
            ctaLink: b.ctaLink,
            position: b.position,
          }))
        : defaultFallback.denimCarousel

    return { hero, split, feature, middle, bottom, editorial, denimCarousel }
  } catch (error) {
    console.error("Error retrieving banners in getHomeBanners:", error)
    return defaultFallback
  }
}
