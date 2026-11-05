"use client"

import Link from "next/link"
import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Cloud,
  Compass,
  Eye,
  GripVertical,
  ImageIcon,
  LoaderCircle,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  Smartphone,
  Tag,
  Trash2,
  UploadCloud,
} from "lucide-react"
import { toast } from "sonner"

import {
  addHeroSlideAction,
  createBannerAction,
  listHeroSlidesAction,
  listStoreRedirectRoutesAction,
  reorderBannersAction,
  type StoreRouteOption,
  updateBannerAction,
} from "@/app/actions/banners"
import { BannerMediaLibraryDialog } from "@/components/admin-dashboard/banner-media-library-dialog"
import { BannerMediaPreview } from "@/components/admin-dashboard/banner-media-preview"
import { BannerPlacementPreview } from "@/components/admin-dashboard/banner-placement-preview"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  BANNER_IMAGE_CONTENT_TYPES,
  BANNER_VIDEO_CONTENT_TYPES,
  isBannerVideoContentType,
  MAX_BANNER_IMAGE_BYTES,
  MAX_BANNER_VIDEO_BYTES,
} from "@/lib/banner-media"
import type { AdminBannerDetail, AdminBannerListItem } from "@/lib/server/dal/banners"
import type { BannerPlacement, BannerTextAlignment } from "@/lib/validations/banner"

const BANNER_PLACEMENTS: BannerPlacement[] = [
  "HERO",
  "SPLIT",
  "FEATURE",
  "MIDDLE",
  "BOTTOM",
  "EDITORIAL",
  "DENIM_CAROUSEL",
]

// Full-width banners render through FullWidthBanner, which can play video.
const VIDEO_PLACEMENTS = new Set<BannerPlacement>(["HERO", "FEATURE", "MIDDLE", "BOTTOM"])

type UploadInstruction = {
  objectKey?: string
  uploadUrl?: string
  publicUrl?: string
  error?: string
}

async function readUploadInstruction(response: Response): Promise<UploadInstruction> {
  const body = await response.text()
  if (!body) return { error: "The upload service returned an empty response." }
  try {
    return JSON.parse(body) as UploadInstruction
  } catch {
    return {
      error: `The upload service returned an unexpected response (${response.status}).`,
    }
  }
}

export function BannerEditor({
  banner,
}: {
  banner?: AdminBannerDetail
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isNew = !banner

  const desktopInputRef = useRef<HTMLInputElement>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)

  // Form states
  const [title, setTitle] = useState(banner?.title ?? "")
  const [subtitle, setSubtitle] = useState(banner?.subtitle ?? "")
  const queryPlacement = searchParams?.get("placement") as BannerPlacement | null
  const defaultPlacement: BannerPlacement =
    banner?.placement ??
    (queryPlacement && BANNER_PLACEMENTS.includes(queryPlacement)
      ? queryPlacement
      : "HERO")
  const [placement, setPlacement] = useState<BannerPlacement>(defaultPlacement)
  const [ctaText, setCtaText] = useState(banner?.ctaText ?? "")
  const [ctaLink, setCtaLink] = useState(banner?.ctaLink ?? "/collections")
  const [textAlignment, setTextAlignment] = useState<BannerTextAlignment>(
    banner?.textAlignment ?? "CENTER",
  )
  // Crop focus per device ("x% y%"); null = centre. Set by dragging in the preview.
  const [desktopFocus, setDesktopFocus] = useState<string | null>(banner?.desktopFocus ?? null)
  const [mobileFocus, setMobileFocus] = useState<string | null>(banner?.mobileFocus ?? null)
  const [overlayOpacity, setOverlayOpacity] = useState<number>(
    banner?.overlayOpacity ?? 20,
  )
  const [isActive, setIsActive] = useState<boolean>(banner?.isActive ?? true)
  const queryPosition = searchParams?.get("position")
  const defaultPosition = banner?.position ?? (queryPosition ? parseInt(queryPosition, 10) : 0)
  const [position, setPosition] = useState<number>(defaultPosition)

  // Image states
  const [desktopImage, setDesktopImage] = useState<{
    objectKey: string
    url: string
  } | null>(
    banner
      ? {
          objectKey: banner.desktopImageKey,
          url: banner.desktopImageUrl,
        }
      : null,
  )

  const [mobileImage, setMobileImage] = useState<{
    objectKey: string
    url: string
  } | null>(
    banner?.mobileImageKey
      ? {
          objectKey: banner.mobileImageKey,
          url: banner.mobileImageUrl || banner.desktopImageUrl,
        }
      : null,
  )

  const [isUploadingDesktop, setIsUploadingDesktop] = useState(false)
  const [isUploadingMobile, setIsUploadingMobile] = useState(false)
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false)
  const [mediaLibraryRole, setMediaLibraryRole] = useState<"desktop" | "mobile">("desktop")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({})
  const [isSaving, startSaving] = useTransition()

  // Multi-slide Hero carousel state
  const [heroSlides, setHeroSlides] = useState<AdminBannerListItem[]>([])
  const [isAddingHeroSlide, setIsAddingHeroSlide] = useState(false)
  const [draggedSlideIdx, setDraggedSlideIdx] = useState<number | null>(null)
  const [dragOverSlideIdx, setDragOverSlideIdx] = useState<number | null>(null)
  const [isReorderingSlides, startReorderingSlides] = useTransition()
  const newSlideInputRef = useRef<HTMLInputElement>(null)

  // Store redirect routes state
  const [storeRoutes, setStoreRoutes] = useState<StoreRouteOption[]>([])
  const [routeSearchQuery, setRouteSearchQuery] = useState("")
  const [routeGroupFilter, setRouteGroupFilter] = useState<string>("ALL")
  const [routePickerOpen, setRoutePickerOpen] = useState(false)

  useEffect(() => {
    listStoreRedirectRoutesAction().then((res) => {
      if (res.success) setStoreRoutes(res.routes)
    })
  }, [])

  const reloadHeroSlides = () => {
    listHeroSlidesAction().then((res) => {
      if (res.success) setHeroSlides(res.slides)
    })
  }

  const handleSlideDragStart = (index: number, e: React.DragEvent) => {
    setDraggedSlideIdx(index)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", `${index}`)
  }

  const handleSlideDragOver = (index: number, e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    if (dragOverSlideIdx !== index) {
      setDragOverSlideIdx(index)
    }
  }

  const handleSlideDrop = (targetIndex: number, e: React.DragEvent) => {
    e.preventDefault()
    if (draggedSlideIdx === null || draggedSlideIdx === targetIndex) {
      setDraggedSlideIdx(null)
      setDragOverSlideIdx(null)
      return
    }

    const reordered = [...heroSlides]
    const [moved] = reordered.splice(draggedSlideIdx, 1)
    reordered.splice(targetIndex, 0, moved)

    const updatedWithPositions = reordered.map((slide, idx) => ({
      ...slide,
      position: idx,
    }))

    // Optimistically update local order
    setHeroSlides(updatedWithPositions)
    setDraggedSlideIdx(null)
    setDragOverSlideIdx(null)

    // Persist to database
    startReorderingSlides(async () => {
      const payload = updatedWithPositions.map((slide) => ({
        id: slide.id,
        position: slide.position,
      }))
      const res = await reorderBannersAction({ items: payload })
      if (res.success) {
        toast.success("Slide sequence updated!")
        router.refresh()
      } else {
        toast.error(res.message || "Failed to update slide order.")
        reloadHeroSlides()
      }
    })
  }

  const handleSlideDragEnd = () => {
    setDraggedSlideIdx(null)
    setDragOverSlideIdx(null)
  }

  useEffect(() => {
    if (placement === "HERO") {
      reloadHeroSlides()
    }
  }, [placement])

  const handleAddNewSlideFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    if (files.length === 0) return

    setIsAddingHeroSlide(true)
    let addedCount = 0

    for (const file of files) {
      // Hero slides can be an image or a short looping video.
      const isVideo = isBannerVideoContentType(file.type)
      const isImage = (BANNER_IMAGE_CONTENT_TYPES as readonly string[]).includes(file.type)
      if (!isImage && !isVideo) {
        toast.error(`"${file.name}" is not supported. Use JPG, PNG, WebP, AVIF, MP4 or WebM.`)
        continue
      }
      if (file.size > (isVideo ? MAX_BANNER_VIDEO_BYTES : MAX_BANNER_IMAGE_BYTES)) {
        toast.error(`"${file.name}" is too large (max ${isVideo ? "50" : "10"} MB).`)
        continue
      }

      try {
        const presignRes = await fetch("/api/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            size: file.size,
            sizeBytes: file.size,
            scope: "banner",
          }),
        })

        const instruction = await readUploadInstruction(presignRes)
        if (!instruction.uploadUrl || !instruction.objectKey) {
          toast.error(instruction.error || "Could not prepare upload.")
          continue
        }

        const uploadRes = await fetch(instruction.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        })

        if (!uploadRes.ok) {
          toast.error(`Failed to upload ${file.name} to Cloudflare.`)
          continue
        }

        const addRes = await addHeroSlideAction({
          desktopImageKey: instruction.objectKey,
          title: null,
          subtitle: null,
          ctaText: null,
          ctaLink: "/collections",
        })

        if (addRes.status === "success") {
          addedCount++
        }
      } catch {
        toast.error(`Error processing ${file.name}.`)
      }
    }

    setIsAddingHeroSlide(false)
    if (addedCount > 0) {
      toast.success(`Successfully added ${addedCount} slide(s) to Hero Carousel!`)
      reloadHeroSlides()
      router.refresh()
    }
  }

  // Pre-fill image if passed via query params from media library
  useEffect(() => {
    if (isNew && !desktopImage && searchParams) {
      const qKey = searchParams.get("imageKey")
      const qUrl = searchParams.get("imageUrl")
      if (qKey && qUrl) {
        setDesktopImage({
          objectKey: qKey,
          url: qUrl,
        })
        toast.success("Loaded image from Cloudflare R2 into editor.")
      }
    }
  }, [isNew, searchParams, desktopImage])

  // Quick preset: populate default Pubesto hero banner
  const handleLoadDefaultPreset = () => {
    setTitle("STRAIGHT FIT DENIM")
    setSubtitle("100% COTTON • NON STRETCH")
    setCtaText("EXPLORE COLLECTION")
    setCtaLink("/collections")
    setTextAlignment("CENTER")
    setOverlayOpacity(15)
    setDesktopImage({
      objectKey: "/home-page-content/hero-1.png",
      url: "/home-page-content/hero-1.png",
    })
    setMobileImage({
      objectKey: "/home-page-content/hero-mobile.jpg",
      url: "/home-page-content/hero-mobile.jpg",
    })
    toast.success("Loaded Pubesto brand default preset.")
  }

  // Upload handler
  const handleFileUpload = async (
    file: File,
    type: "desktop" | "mobile",
  ) => {
    const allowsVideo = VIDEO_PLACEMENTS.has(placement)
    const isVideo = isBannerVideoContentType(file.type)
    const isImage = (BANNER_IMAGE_CONTENT_TYPES as readonly string[]).includes(file.type)
    if (!isImage && !(allowsVideo && isVideo)) {
      toast.error(
        allowsVideo
          ? "Please upload an AVIF, JPG, PNG or WebP image, or an MP4 / WebM video."
          : "Please upload an AVIF, JPG, PNG, or WebP image.",
      )
      return
    }
    if (isVideo && file.size > MAX_BANNER_VIDEO_BYTES) {
      toast.error("Video file size must be less than 50 MB.")
      return
    }
    if (!isVideo && file.size > MAX_BANNER_IMAGE_BYTES) {
      toast.error("Image file size must be less than 10 MB.")
      return
    }

    if (type === "desktop") setIsUploadingDesktop(true)
    else setIsUploadingMobile(true)

    try {
      const presignRes = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
          scope: "banner",
        }),
      })

      const presign = await readUploadInstruction(presignRes)
      if (!presignRes.ok || !presign.objectKey || !presign.uploadUrl || !presign.publicUrl) {
        throw new Error(presign.error || "The upload service is unavailable.")
      }

      const uploadRes = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      })

      if (!uploadRes.ok) {
        throw new Error("Failed to upload the image file.")
      }

      if (type === "desktop") {
        setDesktopImage({
          objectKey: presign.objectKey,
          url: presign.publicUrl,
        })
        toast.success("Desktop image uploaded successfully.")
      } else {
        setMobileImage({
          objectKey: presign.objectKey,
          url: presign.publicUrl,
        })
        toast.success("Mobile image uploaded successfully.")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload image.")
    } finally {
      if (type === "desktop") setIsUploadingDesktop(false)
      else setIsUploadingMobile(false)
    }
  }

  const handleSave = () => {
    setFieldErrors({})

    if (!desktopImage?.objectKey) {
      setFieldErrors({ desktopImageKey: ["Please upload a desktop banner image."] })
      toast.error("Desktop image is required.")
      return
    }

    startSaving(async () => {
      const payload = {
        title: title.trim() || null,
        subtitle: subtitle.trim() || null,
        desktopImageKey: desktopImage.objectKey,
        mobileImageKey: mobileImage?.objectKey || null,
        ctaText: ctaText.trim() || null,
        ctaLink: ctaLink.trim() || null,
        placement,
        textAlignment,
        overlayOpacity,
        desktopFocus,
        mobileFocus,
        isActive,
        position,
      }

      const res = isNew
        ? await createBannerAction(payload)
        : await updateBannerAction(banner.id, payload)

      if (res.status === "error") {
        if (res.fields) setFieldErrors(res.fields)
        toast.error(res.message)
        return
      }

      toast.success(isNew ? "Banner created successfully." : "Banner updated successfully.")
      router.push("/dashboard/banners")
      router.refresh()
    })
  }

  const allowsVideo = VIDEO_PLACEMENTS.has(placement)
  const mediaAccept = [
    ...BANNER_IMAGE_CONTENT_TYPES,
    ...(allowsVideo ? BANNER_VIDEO_CONTENT_TYPES : []),
  ].join(",")

  return (
    <main className="min-h-full flex-1 bg-[#f7f7f8] p-4 text-black sm:p-6">
      <div className="mx-auto max-w-7xl">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-black/10">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/banners"
              className="flex size-9 items-center justify-center rounded-lg border border-black/15 bg-white text-neutral-600 transition hover:bg-neutral-50 shadow-sm"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
                {isNew ? "Create Homepage Banner" : "Edit Banner"}
              </h1>
              <p className="text-xs text-neutral-500">
                {isNew
                  ? "Configure banner placement, responsive imagery, CTA buttons, and styling."
                  : `Managing banner ID: ${banner.id}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMediaLibraryOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-black/15 bg-white px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition shadow-sm cursor-pointer"
            >
              <Cloud className="size-3.5 text-blue-600" /> Cloudflare R2 Library
            </button>

            {isNew && (
              <button
                type="button"
                onClick={handleLoadDefaultPreset}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-black/15 bg-white px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition shadow-sm cursor-pointer"
              >
                <RotateCcw className="size-3.5" /> Load Pubesto Preset
              </button>
            )}

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-4 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 transition disabled:opacity-60 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <LoaderCircle className="size-3.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Check className="size-4" /> {isNew ? "Publish Banner" : "Save Changes"}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Editor Form & Live Preview Grid */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Form Settings (Left Column) */}
          <div className="space-y-5 lg:col-span-7">
            {/* Clean Hero Carousel Slide Strip (Only for Hero placement) */}
            {placement === "HERO" && (
              <div className="rounded-xl border border-black/10 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-800">
                      Hero Carousel Slides ({heroSlides.length || 1})
                    </h2>
                    <p className="text-[11px] text-neutral-500">
                      Click a slide to edit it, or add new slides for the homepage slideshow.
                    </p>
                  </div>

                  <input
                    type="file"
                    ref={newSlideInputRef}
                    multiple
                    accept={[...BANNER_IMAGE_CONTENT_TYPES, ...BANNER_VIDEO_CONTENT_TYPES].join(",")}
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) {
                        handleAddNewSlideFiles(e.target.files)
                      }
                    }}
                  />

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isAddingHeroSlide}
                      onClick={() => newSlideInputRef.current?.click()}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-black px-3 text-xs font-semibold text-white hover:bg-neutral-800 transition cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {isAddingHeroSlide ? (
                        <>
                          <LoaderCircle className="size-3.5 animate-spin" /> Adding...
                        </>
                      ) : (
                        <>
                          <Plus className="size-3.5" /> Add Slide
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMediaLibraryRole("desktop")
                        setMediaLibraryOpen(true)
                      }}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-black/15 bg-white px-2.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition cursor-pointer shadow-2xs"
                    >
                      <Cloud className="size-3.5 text-blue-600" /> Library
                    </button>
                  </div>
                </div>

                {/* Subtitle helper */}
                <p className="mt-1 text-[11px] text-neutral-500">
                  Drag any slide card to rearrange its sequence on your homepage slideshow, or click to edit.
                </p>

                {/* Horizontal draggable slide cards */}
                <div className="mt-3 flex items-center gap-2.5 overflow-x-auto pb-1">
                  {heroSlides.map((slide, idx) => {
                    const isCurrent = slide.id === banner?.id
                    const isDragged = draggedSlideIdx === idx
                    const isDragOver = dragOverSlideIdx === idx && draggedSlideIdx !== idx

                    return (
                      <div
                        key={slide.id}
                        draggable={true}
                        onDragStart={(e) => handleSlideDragStart(idx, e)}
                        onDragOver={(e) => handleSlideDragOver(idx, e)}
                        onDrop={(e) => handleSlideDrop(idx, e)}
                        onDragEnd={handleSlideDragEnd}
                        className={`group relative flex items-center gap-2 rounded-lg border p-1.5 pr-3 text-xs transition cursor-grab active:cursor-grabbing select-none shrink-0 ${
                          isDragged
                            ? "opacity-30 scale-95 border-dashed border-black/50 bg-neutral-100"
                            : isDragOver
                              ? "border-black ring-2 ring-black/20 bg-neutral-50 scale-[1.02] shadow-sm"
                              : isCurrent
                                ? "border-black bg-neutral-900 text-white shadow-xs"
                                : "border-black/15 bg-white text-neutral-800 hover:border-black/40 hover:shadow-xs"
                        }`}
                      >
                        {/* Drag grip icon */}
                        <span
                          title="Drag to rearrange order"
                          className={`p-0.5 rounded transition ${
                            isCurrent ? "text-neutral-400 group-hover:text-white" : "text-neutral-400 group-hover:text-black"
                          }`}
                        >
                          <GripVertical className="size-3.5" />
                        </span>

                        {/* Slide link & thumbnail */}
                        <Link
                          href={`/dashboard/banners/${slide.id}`}
                          className="flex items-center gap-2 min-w-0"
                          onClick={(e) => {
                            // If currently dragging, don't trigger navigation
                            if (draggedSlideIdx !== null) {
                              e.preventDefault()
                            }
                          }}
                        >
                          <div className="relative aspect-[16/9] w-12 rounded overflow-hidden bg-neutral-800 shrink-0">
                            <BannerMediaPreview
                              src={slide.desktopImageUrl}
                              alt={`Slide ${idx + 1}`}
                              sizes="48px"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold leading-tight">Slide {idx + 1}</p>
                            <p
                              className={`text-[10px] truncate max-w-[85px] ${
                                isCurrent ? "text-neutral-300" : "text-neutral-500"
                              }`}
                            >
                              {slide.title || "Untitled"}
                            </p>
                          </div>
                        </Link>
                      </div>
                    )
                  })}

                  <button
                    type="button"
                    disabled={isAddingHeroSlide}
                    onClick={() => newSlideInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-dashed border-black/25 bg-neutral-50 px-3 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:border-black transition cursor-pointer shrink-0 h-[44px]"
                  >
                    <Plus className="size-3.5" />
                    <span>Upload Slide</span>
                  </button>
                </div>
              </div>
            )}

            {/* Slide Imagery Card */}
            <div className="rounded-xl border border-black/10 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-900">
                    {allowsVideo ? "Banner Image or Video" : "Slide Image"}
                  </h2>
                  <p className="text-xs text-neutral-500">
                    {placement === "HERO"
                      ? "Full screen. Desktop 1920 × 1080 px (16:9), mobile 1080 × 1920 px (9:16). Image or a short muted MP4/WebM loop up to 50 MB."
                      : placement === "FEATURE"
                      ? "Desktop 1920 × 840 px (16:7), mobile 1080 × 1350 px (4:5). Image or MP4/WebM video up to 50 MB."
                      : placement === "SPLIT"
                        ? "Left slot about 1760 × 1554 px, right slot about 1120 × 1554 px. Mobile 1080 × 1350 px (4:5)."
                      : allowsVideo
                        ? "High-resolution widescreen visual. Image or MP4/WebM video up to 50 MB."
                        : "High-resolution widescreen visual (16:9 ratio recommended)."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMediaLibraryRole("desktop")
                    setMediaLibraryOpen(true)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-black/15 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition shadow-2xs cursor-pointer"
                >
                  <Cloud className="size-3.5 text-blue-600" /> Choose from Library
                </button>
              </div>

              {/* Desktop Image Box */}
              <div className="mt-4">
                <input
                  type="file"
                  ref={desktopInputRef}
                  accept={mediaAccept}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFileUpload(f, "desktop")
                  }}
                />

                {desktopImage?.url ? (
                  <div>
                    <div className="relative aspect-[16/9] max-h-[260px] w-full overflow-hidden rounded-lg border border-black/15 bg-neutral-900 shadow-xs">
                      <BannerMediaPreview
                        src={desktopImage.url}
                        alt="Slide Desktop Visual"
                        sizes="(max-width: 1024px) 100vw, 640px"
                      />
                    </div>

                    {/* Always-visible clean action bar */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => desktopInputRef.current?.click()}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-black/15 bg-white px-3 text-xs font-medium text-neutral-800 hover:bg-neutral-50 transition cursor-pointer shadow-2xs"
                      >
                        <UploadCloud className="size-3.5" /> Upload New Image
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMediaLibraryRole("desktop")
                          setMediaLibraryOpen(true)
                        }}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-black/15 bg-white px-3 text-xs font-medium text-neutral-800 hover:bg-neutral-50 transition cursor-pointer shadow-2xs"
                      >
                        <Cloud className="size-3.5 text-blue-600" /> Choose from Library
                      </button>
                      <button
                        type="button"
                        onClick={() => setDesktopImage(null)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/70 px-2.5 text-xs font-medium text-red-600 hover:bg-red-100 transition cursor-pointer shadow-2xs ml-auto"
                      >
                        <Trash2 className="size-3.5" /> Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => desktopInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 p-8 text-center hover:border-black transition cursor-pointer bg-neutral-50/50 ${
                      fieldErrors.desktopImageKey ? "border-red-400 bg-red-50/30" : ""
                    }`}
                  >
                    {isUploadingDesktop ? (
                      <div className="flex flex-col items-center gap-2">
                        <LoaderCircle className="size-6 animate-spin text-neutral-600" />
                        <span className="text-xs font-medium text-neutral-600">
                          Uploading image to Cloudflare...
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="flex size-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                          <UploadCloud className="size-5" />
                        </div>
                        <p className="mt-2 text-xs font-semibold text-neutral-900">
                          Click to upload slide image, or drag and drop
                        </p>
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          {allowsVideo
                            ? "PNG, JPG, WebP, AVIF, MP4 or WebM"
                            : "PNG, JPG, WebP, or AVIF (1672 × 941 px recommended)"}
                        </p>
                      </>
                    )}
                  </div>
                )}
                {fieldErrors.desktopImageKey && (
                  <p className="mt-1.5 text-xs text-red-600 font-medium">
                    {fieldErrors.desktopImageKey[0]}
                  </p>
                )}
              </div>

              {/* Optional Mobile Image Variant */}
              <div className="mt-4 pt-4 border-t border-black/5">
                <input
                  type="file"
                  ref={mobileInputRef}
                  accept={mediaAccept}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFileUpload(f, "mobile")
                  }}
                />

                {mobileImage?.url ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                        <Smartphone className="size-3.5 text-neutral-500" /> Mobile Portrait Variant
                      </span>
                      <button
                        type="button"
                        onClick={() => setMobileImage(null)}
                        className="text-xs text-red-600 hover:underline cursor-pointer"
                      >
                        Remove Mobile Variant
                      </button>
                    </div>
                    <div className="relative h-44 w-32 overflow-hidden rounded-lg border border-black/15 bg-neutral-900 shadow-xs group">
                      <BannerMediaPreview
                        src={mobileImage.url}
                        alt="Mobile Variant"
                        sizes="128px"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => mobileInputRef.current?.click()}
                          className="rounded bg-white px-2 py-1 text-[10px] font-semibold text-black shadow-md hover:bg-neutral-100 transition cursor-pointer"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500 flex items-center gap-1.5">
                      <Smartphone className="size-3.5" /> Mobile Portrait Image: Uses desktop image by default
                    </span>
                    <button
                      type="button"
                      onClick={() => mobileInputRef.current?.click()}
                      className="font-medium text-black hover:underline cursor-pointer"
                    >
                      + Add Mobile Variant
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Typography & CTA Button */}
            <div className="rounded-xl border border-black/10 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-900">Text & CTA Button (Optional)</h2>
                  <p className="text-xs text-neutral-500">
                    Optional headline, subtitle, and button. Leave blank for a clean photo-only banner.
                  </p>
                </div>
                {(title || subtitle || ctaText) && (
                  <button
                    type="button"
                    onClick={() => {
                      setTitle("")
                      setSubtitle("")
                      setCtaText("")
                      toast.success("Cleared all text overlay.")
                    }}
                    className="text-xs text-neutral-500 hover:text-black hover:underline cursor-pointer"
                  >
                    Clear All Text
                  </button>
                )}
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-800">
                    Headline Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. STRAIGHT FIT DENIM or NEW ARRIVALS"
                    className="mt-1 w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-xs text-neutral-900 uppercase tracking-wider focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                  <p className="mt-1 text-[11px] text-neutral-400">
                    Leave blank if your banner graphic already includes text baked into the image.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-800">
                    Subtitle / Tagline
                  </label>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="e.g. 100% COTTON • NON STRETCH"
                    className="mt-1 w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-xs text-neutral-900 tracking-wider focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-800">
                      CTA Button Label
                    </label>
                    <input
                      type="text"
                      value={ctaText}
                      onChange={(e) => setCtaText(e.target.value)}
                      placeholder="e.g. EXPLORE COLLECTION"
                      className="mt-1 w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-xs text-neutral-900 uppercase tracking-wider focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-neutral-800">
                        CTA Destination Link
                      </label>

                      {/* Dropdown browse trigger */}
                      <Popover open={routePickerOpen} onOpenChange={setRoutePickerOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-700 hover:text-black cursor-pointer"
                          >
                            <Search className="size-3 text-neutral-500" />
                            <span>Browse Routes ▾</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          align="end"
                          className="w-80 p-0 shadow-2xl border border-black/15 bg-white rounded-xl overflow-hidden z-50"
                        >
                          {/* Search Header */}
                          <div className="p-2.5 border-b border-black/10 bg-neutral-50/70">
                            <label className="flex h-8 items-center gap-2 rounded-lg border border-black/15 bg-white px-2.5 text-xs">
                              <Search className="size-3.5 text-neutral-400 shrink-0" />
                              <input
                                autoFocus
                                value={routeSearchQuery}
                                onChange={(e) => setRouteSearchQuery(e.target.value)}
                                placeholder="Search pages, collections, products..."
                                className="w-full bg-transparent text-xs text-neutral-900 outline-none placeholder:text-neutral-400"
                              />
                              {routeSearchQuery && (
                                <button
                                  type="button"
                                  onClick={() => setRouteSearchQuery("")}
                                  className="text-[10px] text-neutral-400 hover:text-black"
                                >
                                  Clear
                                </button>
                              )}
                            </label>

                            {/* Group Filter Tabs */}
                            <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-0.5">
                              {["ALL", "Pages", "Collections", "Categories", "Products"].map((group) => (
                                <button
                                  key={group}
                                  type="button"
                                  onClick={() => setRouteGroupFilter(group)}
                                  className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition cursor-pointer whitespace-nowrap ${
                                    routeGroupFilter === group
                                      ? "bg-black text-white"
                                      : "bg-white text-neutral-600 border border-black/10 hover:border-black/30"
                                  }`}
                                >
                                  {group}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* List of Routes */}
                          <div className="max-h-60 overflow-y-auto divide-y divide-black/5 p-1">
                            {storeRoutes
                              .filter((route) => {
                                if (routeGroupFilter !== "ALL" && route.group !== routeGroupFilter) {
                                  return false
                                }
                                if (!routeSearchQuery.trim()) return true
                                const q = routeSearchQuery.toLowerCase().trim()
                                return route.label.toLowerCase().includes(q) || route.path.toLowerCase().includes(q)
                              })
                              .length === 0 ? (
                              <div className="p-4 text-center text-xs text-neutral-500">
                                No matching store routes found.
                              </div>
                            ) : (
                              storeRoutes
                                .filter((route) => {
                                  if (routeGroupFilter !== "ALL" && route.group !== routeGroupFilter) {
                                    return false
                                  }
                                  if (!routeSearchQuery.trim()) return true
                                  const q = routeSearchQuery.toLowerCase().trim()
                                  return route.label.toLowerCase().includes(q) || route.path.toLowerCase().includes(q)
                                })
                                .map((r) => {
                                  const isSelected = ctaLink === r.path
                                  return (
                                    <button
                                      key={`${r.group}-${r.path}`}
                                      type="button"
                                      onClick={() => {
                                        setCtaLink(r.path)
                                        setRoutePickerOpen(false)
                                        toast.success(`Selected route: ${r.path}`)
                                      }}
                                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition cursor-pointer ${
                                        isSelected
                                          ? "bg-neutral-900 text-white"
                                          : "hover:bg-neutral-100 text-neutral-800"
                                      }`}
                                    >
                                      <div className="min-w-0 pr-2">
                                        <p className="font-semibold truncate">{r.label}</p>
                                        <p
                                          className={`font-mono text-[10px] truncate ${
                                            isSelected ? "text-neutral-300" : "text-neutral-500"
                                          }`}
                                        >
                                          {r.path}
                                        </p>
                                      </div>
                                      <span
                                        className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ${
                                          isSelected
                                            ? "bg-white/20 text-white"
                                            : "bg-black/[0.06] text-neutral-600"
                                        }`}
                                      >
                                        {r.group}
                                      </span>
                                    </button>
                                  )
                                })
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Input with embedded dropdown button */}
                    <div className="relative mt-1 flex items-center">
                      <input
                        type="text"
                        value={ctaLink}
                        onChange={(e) => setCtaLink(e.target.value)}
                        placeholder="e.g. /collections or /products"
                        className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 pr-20 text-xs font-mono text-neutral-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                      />
                      <Popover open={routePickerOpen} onOpenChange={setRoutePickerOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="absolute right-1.5 inline-flex h-7 items-center gap-1 rounded-md bg-neutral-100 px-2 text-[11px] font-medium text-neutral-700 hover:bg-neutral-200 transition cursor-pointer"
                          >
                            <span>Browse</span>
                            <ChevronDown className="size-3" />
                          </button>
                        </PopoverTrigger>
                      </Popover>
                    </div>

                    {/* Quick route chips */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-neutral-400">Quick:</span>
                      {[
                        { label: "/collections", path: "/collections" },
                        { label: "/products", path: "/products" },
                        { label: "/cart", path: "/cart" },
                        { label: "/size-guide", path: "/size-guide" },
                      ].map((chip) => (
                        <button
                          key={chip.path}
                          type="button"
                          onClick={() => setCtaLink(chip.path)}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-mono transition cursor-pointer ${
                            ctaLink === chip.path
                              ? "bg-black text-white font-semibold"
                              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                          }`}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Alignment & Overlay */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-3 border-t border-black/5">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-800">
                      Text & Button Alignment
                    </label>
                    <div className="mt-1.5 flex rounded-lg border border-black/15 p-1 bg-neutral-50/50">
                      {(["LEFT", "CENTER", "RIGHT"] as const).map((align) => (
                        <button
                          key={align}
                          type="button"
                          onClick={() => setTextAlignment(align)}
                          className={`flex-1 rounded py-1 text-center text-xs font-semibold transition cursor-pointer ${
                            textAlignment === align
                              ? "bg-white text-black shadow-xs border border-black/10"
                              : "text-neutral-500 hover:text-black"
                          }`}
                        >
                          {align}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-neutral-800">
                        Dark Overlay Opacity
                      </label>
                      <span className="font-mono text-xs text-neutral-600">
                        {overlayOpacity}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={80}
                      step={5}
                      value={overlayOpacity}
                      onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                      className="mt-3 w-full accent-black cursor-pointer"
                    />
                    <p className="mt-1 text-[11px] text-neutral-400">
                      Subtle dark gradient for text legibility over bright imagery.
                    </p>
                  </div>
                </div>

                {/* Display sort order */}
                <div className="pt-3 border-t border-black/5">
                  <label className="block text-xs font-semibold text-neutral-800">
                    Sort Position / Slide Sequence
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={position}
                    onChange={(e) => setPosition(Number(e.target.value))}
                    className="mt-1 w-32 rounded-lg border border-black/15 bg-white px-3 py-1.5 text-xs text-neutral-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                  <p className="mt-1 text-[11px] text-neutral-400">
                    Lowest number appears first in the carousel / page.
                  </p>
                </div>
              </div>
            </div>

            {/* Banner Placement & Status */}
            <div className="rounded-xl border border-black/10 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-neutral-900">Placement & Visibility</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-neutral-800">
                    Banner Placement
                  </label>
                  <select
                    value={placement}
                    onChange={(e) => setPlacement(e.target.value as BannerPlacement)}
                    className="mt-1.5 w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-xs font-medium text-neutral-900 shadow-xs focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  >
                    <option value="HERO">Hero Banner (Top Carousel)</option>
                    <option value="SPLIT">Split Pair (2 Images Below Hero)</option>
                    <option value="FEATURE">Feature Banner (Below Our Favourite · Image or Video)</option>
                    <option value="MIDDLE">Middle Banner (Motion Section)</option>
                    <option value="DENIM_CAROUSEL">Denim Carousel (Collection Slide)</option>
                    <option value="EDITORIAL">Denim Editorial Grid (3 Images)</option>
                    <option value="BOTTOM">Bottom Banner (Product Section)</option>
                  </select>
                </div>

                {placement === "SPLIT" && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-800">
                      Split Slot
                    </label>
                    <select
                      value={position}
                      onChange={(e) => setPosition(parseInt(e.target.value, 10))}
                      className="mt-1.5 w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-xs font-medium text-neutral-900 shadow-xs focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                    >
                      <option value={0}>Slot 1: Left, wide (about 880 × 777)</option>
                      <option value={1}>Slot 2: Right, narrow (about 560 × 777)</option>
                    </select>
                  </div>
                )}

                {placement === "EDITORIAL" && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-800">
                      Editorial Slot
                    </label>
                    <select
                      value={position}
                      onChange={(e) => setPosition(parseInt(e.target.value, 10))}
                      className="mt-1.5 w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-xs font-medium text-neutral-900 shadow-xs focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                    >
                      <option value={0}>Slot 1: Top-Left Square (1:1 Ratio)</option>
                      <option value={1}>Slot 2: Top-Right Square (1:1 Ratio)</option>
                      <option value={2}>Slot 3: Bottom Wide Banner (20:9 Ratio)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-neutral-800">
                    Visibility
                  </label>
                  <div className="mt-1.5 flex items-center gap-3">
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-black peer-checked:after:translate-x-full peer-focus:outline-none" />
                      <span className="ml-2.5 text-xs font-semibold text-neutral-800">
                        {isActive ? "Active (Visible)" : "Draft (Hidden)"}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Live Storefront Preview (Right Column) */}
          <div className="lg:col-span-5">
            <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto rounded-xl border border-black/10 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-1.5 border-b border-black/10 pb-3">
                <Eye className="size-4 text-neutral-600" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-800">
                  Live Storefront Preview
                </h3>
              </div>
              <BannerPlacementPreview
                placement={placement}
                position={position}
                desktopSrc={desktopImage?.url || "/home-page-content/hero-1.png"}
                mobileSrc={mobileImage?.url ?? null}
                overlayOpacity={overlayOpacity}
                title={title}
                subtitle={subtitle}
                ctaText={ctaText}
                textAlignment={textAlignment}
                desktopFocus={desktopFocus}
                mobileFocus={mobileFocus}
                onDesktopFocusChange={setDesktopFocus}
                onMobileFocusChange={setMobileFocus}
              />
            </div>
          </div>
        </div>
      </div>

      <BannerMediaLibraryDialog
        open={mediaLibraryOpen}
        onOpenChange={setMediaLibraryOpen}
        initialTargetRole={mediaLibraryRole}
        onSelectImage={(img, role) => {
          if (role === "mobile") {
            setMobileImage(img)
          } else {
            setDesktopImage(img)
          }
        }}
      />
    </main>
  )
}
