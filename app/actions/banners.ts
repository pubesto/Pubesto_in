"use server"

import { permissionErrorMessage } from "@/lib/server/dal/auth"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import {
  createBanner,
  deleteBanners,
  deleteStoredBannerImage,
  listStoredBannerImages,
  reorderBanners,
  type StoredBannerImage,
  updateBanner,
  updateBannerActive,
} from "@/lib/server/services/banners"
import { getPrisma } from "@/lib/server/db"
import { listHeroSlidesForAdmin, type AdminBannerListItem } from "@/lib/server/dal/banners"
import { bannerInputSchema, reorderBannerSchema } from "@/lib/validations/banner"

export type BannerActionState =
  | { status: "success"; bannerId: string }
  | {
      status: "error"
      message: string
      fields?: Record<string, string[] | undefined>
    }

function revalidateBannerPaths(bannerId?: string) {
  revalidatePath("/")
  revalidatePath("/dashboard/banners")
  revalidatePath("/dashboard/banners/new")

  if (bannerId) {
    revalidatePath(`/dashboard/banners/${bannerId}`)
  }
}

function mutationError(error: unknown) {
  const denied = permissionErrorMessage(error)
  if (denied) return denied
  if (error instanceof Error) {
    if (error.message === "Unauthorized") return "Sign in to continue."
    if (error.message === "Forbidden") return "Administrator access is required."
    if (error.message === "SuperAdminRequired") return "Only a full administrator can do this."
    if (error.message === "Banner not found.") return error.message
  }

  return "The banner could not be saved. Try again."
}

export async function createBannerAction(
  input: unknown,
): Promise<BannerActionState> {
  const result = bannerInputSchema.safeParse(input)
  if (!result.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fields: z.flattenError(result.error).fieldErrors,
    }
  }

  try {
    const banner = await createBanner(result.data)
    revalidateBannerPaths(banner.id)
    return { status: "success", bannerId: banner.id }
  } catch (error) {
    return { status: "error", message: mutationError(error) }
  }
}

export async function updateBannerAction(
  bannerId: string,
  input: unknown,
): Promise<BannerActionState> {
  const id = z.string().trim().min(1).safeParse(bannerId)
  const result = bannerInputSchema.safeParse(input)

  if (!id.success || !result.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fields: result.success ? undefined : z.flattenError(result.error).fieldErrors,
    }
  }

  try {
    const banner = await updateBanner(id.data, result.data)
    revalidateBannerPaths(banner.id)
    return { status: "success", bannerId: banner.id }
  } catch (error) {
    return { status: "error", message: mutationError(error) }
  }
}

export async function updateBannerActiveAction(
  bannerId: string,
  isActive: boolean,
) {
  const id = z.string().trim().min(1).safeParse(bannerId)
  if (!id.success) {
    return { success: false, message: "Invalid banner." }
  }

  try {
    await updateBannerActive(id.data, z.boolean().parse(isActive))
    revalidateBannerPaths(id.data)
    return { success: true }
  } catch (error) {
    return { success: false, message: mutationError(error) }
  }
}

export async function deleteBannersAction(bannerIds: unknown) {
  const ids = z.array(z.string().trim().min(1)).min(1).max(50).safeParse(bannerIds)
  if (!ids.success) {
    return { success: false, message: "Select at least one banner." }
  }

  try {
    const deleted = await deleteBanners([...new Set(ids.data)])
    revalidateBannerPaths()
    return { success: true, count: deleted.count }
  } catch (error) {
    return { success: false, message: mutationError(error) }
  }
}

export async function reorderBannersAction(input: unknown) {
  const result = reorderBannerSchema.safeParse(input)
  if (!result.success) {
    return { success: false, message: "Invalid order data." }
  }

  try {
    await reorderBanners(result.data.items)
    revalidateBannerPaths()
    return { success: true }
  } catch (error) {
    return { success: false, message: mutationError(error) }
  }
}

export async function listStoredBannersAction(): Promise<{
  success: boolean
  images: StoredBannerImage[]
  message?: string
}> {
  try {
    const images = await listStoredBannerImages()
    return { success: true, images }
  } catch (error) {
    return {
      success: false,
      images: [],
      message: mutationError(error),
    }
  }
}

export async function deleteStoredBannerImageAction(key: string): Promise<{
  success: boolean
  message?: string
}> {
  const parsedKey = z.string().trim().min(1).safeParse(key)
  if (!parsedKey.success) {
    return { success: false, message: "Invalid image key." }
  }

  try {
    await deleteStoredBannerImage(parsedKey.data)
    revalidateBannerPaths()
    return { success: true }
  } catch (error) {
    return {
      success: false,
      message: mutationError(error),
    }
  }
}

export async function listHeroSlidesAction(): Promise<{
  success: boolean
  slides: AdminBannerListItem[]
}> {
  try {
    const slides = await listHeroSlidesForAdmin()
    return { success: true, slides }
  } catch {
    return { success: false, slides: [] }
  }
}

export async function addHeroSlideAction(input: {
  desktopImageKey: string
  title?: string | null
  subtitle?: string | null
  ctaText?: string | null
  ctaLink?: string | null
}): Promise<BannerActionState> {
  const prisma = getPrisma()
  if (!prisma || !("banner" in prisma) || !prisma.banner) {
    return { status: "error", message: "Database not connected." }
  }

  try {
    const highest = await prisma.banner.findFirst({
      where: { placement: "HERO" },
      orderBy: { position: "desc" },
      select: { position: true },
    })
    const nextPos = (highest?.position ?? -1) + 1

    const banner = await createBanner({
      desktopImageKey: input.desktopImageKey,
      placement: "HERO",
      isActive: true,
      position: nextPos,
      title: input.title?.trim() || null,
      subtitle: input.subtitle?.trim() || null,
      ctaText: input.ctaText?.trim() || null,
      ctaLink: input.ctaLink?.trim() || "/collections",
      textAlignment: "CENTER",
      overlayOpacity: 10,
    })

    revalidateBannerPaths(banner.id)
    return { status: "success", bannerId: banner.id }
  } catch (error) {
    return { status: "error", message: mutationError(error) }
  }
}

export async function addCarouselSlideAction(input: {
  desktopImageKey: string
  title?: string | null
  subtitle?: string | null
  ctaText?: string | null
  ctaLink?: string | null
}): Promise<BannerActionState> {
  const prisma = getPrisma()
  if (!prisma || !("banner" in prisma) || !prisma.banner) {
    return { status: "error", message: "Database not connected." }
  }

  try {
    const highest = await prisma.banner.findFirst({
      where: { placement: "DENIM_CAROUSEL" },
      orderBy: { position: "desc" },
      select: { position: true },
    })
    const nextPos = (highest?.position ?? -1) + 1

    const banner = await createBanner({
      desktopImageKey: input.desktopImageKey,
      placement: "DENIM_CAROUSEL",
      isActive: true,
      position: nextPos,
      title: input.title?.trim() || null,
      subtitle: input.subtitle?.trim() || null,
      ctaText: input.ctaText?.trim() || null,
      ctaLink: input.ctaLink?.trim() || "/collections",
      textAlignment: "CENTER",
      overlayOpacity: 0,
    })

    revalidateBannerPaths(banner.id)
    return { status: "success", bannerId: banner.id }
  } catch (error) {
    return { status: "error", message: mutationError(error) }
  }
}

export type StoreRouteOption = {
  label: string
  path: string
  group: "Pages" | "Collections" | "Categories" | "Products"
  subtitle?: string
}

export async function listStoreRedirectRoutesAction(): Promise<{
  success: boolean
  routes: StoreRouteOption[]
}> {
  const defaultPages: StoreRouteOption[] = [
    { label: "All Collections", path: "/collections", group: "Pages", subtitle: "Full collection catalog" },
    { label: "All Products", path: "/products", group: "Pages", subtitle: "All store products" },
    { label: "Shopping Bag", path: "/cart", group: "Pages", subtitle: "Checkout bag" },
    { label: "Wishlist", path: "/wishlist", group: "Pages", subtitle: "Saved customer favorites" },
    { label: "Track Order", path: "/track-order", group: "Pages", subtitle: "Order status tracking" },
    { label: "Size Guide", path: "/size-guide", group: "Pages", subtitle: "Measurements & fit guide" },
    { label: "Returns Policy", path: "/returns-policy", group: "Pages", subtitle: "Returns & exchanges" },
    { label: "Contact Us", path: "/contact", group: "Pages", subtitle: "Support & inquiries" },
    { label: "Storefront Home", path: "/", group: "Pages", subtitle: "Main landing page" },
  ]

  try {
    const prisma = getPrisma()
    if (!prisma || !("banner" in prisma)) {
      return { success: true, routes: defaultPages }
    }

    const [collections, categories, products] = await Promise.all([
      prisma.collection.findMany({
        where: { isPublished: true },
        select: { title: true, slug: true },
        orderBy: { title: "asc" },
        take: 40,
      }).catch(() => []),
      prisma.category.findMany({
        select: { name: true, slug: true },
        orderBy: { name: "asc" },
        take: 40,
      }).catch(() => []),
      prisma.product.findMany({
        where: { status: "ACTIVE" },
        select: { title: true, slug: true },
        orderBy: { title: "asc" },
        take: 40,
      }).catch(() => []),
    ])

    const collectionRoutes: StoreRouteOption[] = collections.map((c) => ({
      label: c.title,
      path: `/collections/${c.slug}`,
      group: "Collections",
      subtitle: `/collections/${c.slug}`,
    }))

    const categoryRoutes: StoreRouteOption[] = categories.map((cat) => ({
      label: cat.name,
      path: `/collections/${cat.slug}`,
      group: "Categories",
      subtitle: `/collections/${cat.slug}`,
    }))

    const productRoutes: StoreRouteOption[] = products.map((p) => ({
      label: p.title,
      path: `/products/${p.slug}`,
      group: "Products",
      subtitle: `/products/${p.slug}`,
    }))

    return {
      success: true,
      routes: [...defaultPages, ...collectionRoutes, ...categoryRoutes, ...productRoutes],
    }
  } catch {
    return {
      success: true,
      routes: defaultPages,
    }
  }
}

