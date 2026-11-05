/** Banner media can be an image or a short looping video (MP4 / WebM). */
export const BANNER_VIDEO_CONTENT_TYPES = ["video/mp4", "video/webm"] as const
export const BANNER_IMAGE_CONTENT_TYPES = ["image/avif", "image/jpeg", "image/png", "image/webp"] as const

export const MAX_BANNER_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_BANNER_VIDEO_BYTES = 50 * 1024 * 1024

const VIDEO_EXTENSION = /\.(?:mp4|webm)(?:[?#].*)?$/i

export function isVideoMedia(urlOrKey: string | null | undefined): boolean {
  return Boolean(urlOrKey && VIDEO_EXTENSION.test(urlOrKey))
}

export function isBannerVideoContentType(contentType: string): boolean {
  return (BANNER_VIDEO_CONTENT_TYPES as readonly string[]).includes(contentType)
}

export const BANNER_FOCUS_CENTER = "50% 50%"

/**
 * Class + CSS variables that crop a banner image/video around the focus
 * points set in the admin (see .banner-focus in globals.css). Returns nothing
 * when no focus is set, so components keep their own default positioning.
 * `breakpoint` is where that component switches from its phone to desktop layout.
 */
export function bannerFocusProps(
  desktopFocus?: string | null,
  mobileFocus?: string | null,
  breakpoint: "sm" | "md" = "sm",
): { className?: string; style?: Record<string, string> } {
  if (!desktopFocus && !mobileFocus) return {}
  return {
    className: breakpoint === "md" ? "banner-focus-md" : "banner-focus",
    style: {
      "--focus-desktop": desktopFocus || BANNER_FOCUS_CENTER,
      "--focus-mobile": mobileFocus || BANNER_FOCUS_CENTER,
    },
  }
}
