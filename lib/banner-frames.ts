import type { BannerPlacement } from "@/lib/validations/banner"

/**
 * How big each banner slot is on the storefront, so the admin preview can show
 * the exact crop. Widths are CSS pixels on a 1440px desktop and a 390px phone;
 * keep these in step with the homepage components when their sizes change.
 */
export type BannerFrame = {
  /** Width ÷ height of the visible area. */
  aspect: number
  /** Rendered width in CSS px (used to judge sharpness). */
  width: number
  /** Human label, e.g. "Full screen". */
  label: string
}

export type BannerFrames = { desktop: BannerFrame; mobile: BannerFrame }

const DESKTOP_W = 1440
const MOBILE_W = 390

export function getBannerFrames(
  placement: BannerPlacement,
  position: number,
  opts: { hasMobileImage: boolean },
): BannerFrames {
  switch (placement) {
    case "HERO":
      // Fills the whole screen (100svh) under a transparent header.
      return {
        desktop: { aspect: 1440 / 900, width: DESKTOP_W, label: "Full screen (laptop 1440 × 900)" },
        mobile: { aspect: 390 / 844, width: MOBILE_W, label: "Full screen (phone 390 × 844)" },
      }
    case "SPLIT":
      return position === 0
        ? {
            desktop: { aspect: 878 / 777, width: 878, label: "Left 61% of the row" },
            mobile: { aspect: 4 / 5, width: MOBILE_W, label: "Full width, 4:5" },
          }
        : {
            desktop: { aspect: 562 / 777, width: 562, label: "Right 39% of the row" },
            mobile: { aspect: 4 / 5, width: MOBILE_W, label: "Full width, 4:5" },
          }
    case "FEATURE":
      return {
        desktop: { aspect: 16 / 7, width: DESKTOP_W, label: "Full width, 16:7" },
        mobile: opts.hasMobileImage
          ? { aspect: 4 / 5, width: MOBILE_W, label: "Full width, 4:5" }
          : { aspect: 16 / 9, width: MOBILE_W, label: "Full width, 16:9" },
      }
    case "MIDDLE":
      return {
        desktop: { aspect: 2 / 1, width: DESKTOP_W, label: "Full width, 2:1" },
        mobile: { aspect: 4 / 3, width: MOBILE_W, label: "Full width, 4:3" },
      }
    case "BOTTOM":
      return {
        desktop: { aspect: 1440 / 449, width: DESKTOP_W, label: "Full width, slim strip" },
        mobile: { aspect: 16 / 7, width: MOBILE_W, label: "Full width, 16:7" },
      }
    case "EDITORIAL":
      return position === 2
        ? {
            desktop: { aspect: 20 / 9, width: DESKTOP_W, label: "Full width, 20:9" },
            mobile: { aspect: 17 / 9, width: MOBILE_W, label: "Full width, 17:9" },
          }
        : {
            desktop: { aspect: 1, width: 720, label: "Half width, square" },
            mobile: { aspect: 1, width: MOBILE_W, label: "Full width, square" },
          }
    case "DENIM_CAROUSEL":
      // 40vw wide × screen height below the header (scrolling strip).
      return {
        desktop: { aspect: 576 / 802, width: 576, label: "Tall tile, 40% of screen width" },
        mobile: { aspect: 312 / 788, width: 312, label: "Tall tile, 80% of phone width" },
      }
  }
}

export type CropInfo = {
  /** Fraction of the image width / height that stays visible (0–1). */
  visibleW: number
  visibleH: number
  /** Which edges get cut. */
  cut: "none" | "sides" | "top-bottom"
  /** Percentage of the image hidden in total. */
  hiddenPercent: number
}

/** What object-fit: cover (centred) keeps of an image inside a frame. */
export function computeCrop(imageW: number, imageH: number, frameAspect: number): CropInfo {
  const imageAspect = imageW / imageH
  if (Math.abs(imageAspect - frameAspect) / frameAspect < 0.01) {
    return { visibleW: 1, visibleH: 1, cut: "none", hiddenPercent: 0 }
  }
  if (imageAspect > frameAspect) {
    const visibleW = frameAspect / imageAspect
    return { visibleW, visibleH: 1, cut: "sides", hiddenPercent: Math.round((1 - visibleW) * 100) }
  }
  const visibleH = imageAspect / frameAspect
  return { visibleW: 1, visibleH, cut: "top-bottom", hiddenPercent: Math.round((1 - visibleH) * 100) }
}

export type Sharpness = "sharp" | "ok" | "soft"

/**
 * Compares the pixels that actually reach the screen with the slot width.
 * 2× covers retina laptops and phones; below 1× the browser has to stretch it.
 */
export function judgeSharpness(imageW: number, crop: CropInfo, frame: BannerFrame): Sharpness {
  const ratio = (imageW * crop.visibleW) / frame.width
  return ratio >= 1.8 ? "sharp" : ratio >= 1 ? "ok" : "soft"
}

/** Ideal upload size for a slot: its exact shape at 2× its on-screen width. */
export function recommendedSize(frame: BannerFrame) {
  const w = frame.width * 2
  return { w, h: Math.round(w / frame.aspect) }
}
