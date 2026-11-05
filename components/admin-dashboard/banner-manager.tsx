"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Cloud,
  ExternalLink,
  GripVertical,
  ImageIcon,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Smartphone,
  Sparkles,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { BannerMediaLibraryDialog } from "@/components/admin-dashboard/banner-media-library-dialog"
import { BannerMediaPreview } from "@/components/admin-dashboard/banner-media-preview"
import {
  BANNER_IMAGE_CONTENT_TYPES,
  BANNER_VIDEO_CONTENT_TYPES,
  isBannerVideoContentType,
  MAX_BANNER_IMAGE_BYTES,
  MAX_BANNER_VIDEO_BYTES,
} from "@/lib/banner-media"
import {
  addCarouselSlideAction,
  addHeroSlideAction,
  deleteBannersAction,
  reorderBannersAction,
  updateBannerActiveAction,
} from "@/app/actions/banners"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { AdminBannerListItem } from "@/lib/server/dal/banners"

type UploadInstruction = {
  uploadUrl?: string
  objectKey?: string
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

/** Sections from the original template; the Pubesto homepage only uses the hero carousel. */
const SHOW_LEGACY_SECTIONS = false

export function BannerManager({
  initialBanners,
}: {
  initialBanners: AdminBannerListItem[]
}) {
  const router = useRouter()
  const [banners, setBanners] = useState<AdminBannerListItem[]>(initialBanners)
  const [heroExpanded, setHeroExpanded] = useState<boolean>(true)
  const [carouselExpanded, setCarouselExpanded] = useState<boolean>(false)
  const [editorialExpanded, setEditorialExpanded] = useState<boolean>(false)
  const [query, setQuery] = useState("")
  const [bannersToDelete, setBannersToDelete] = useState<string[] | null>(null)
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false)
  const [draggedSlideIdx, setDraggedSlideIdx] = useState<number | null>(null)
  const [dragOverSlideIdx, setDragOverSlideIdx] = useState<number | null>(null)
  const [draggedCarouselIdx, setDraggedCarouselIdx] = useState<number | null>(null)
  const [dragOverCarouselIdx, setDragOverCarouselIdx] = useState<number | null>(null)
  const [isUploadingSlide, setIsUploadingSlide] = useState(false)
  const [isUploadingCarouselSlide, setIsUploadingCarouselSlide] = useState(false)
  const [isPending, startTransition] = useTransition()

  const heroUploadRef = useRef<HTMLInputElement>(null)
  const carouselUploadRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setBanners(initialBanners)
  }, [initialBanners])

  const heroBanners = banners
    .filter((b) => b.placement === "HERO")
    .sort((a, b) => a.position - b.position)
  const splitBanners = banners.filter((b) => b.placement === "SPLIT")
  const featureBanner = banners.find((b) => b.placement === "FEATURE")
  const middleBanner = banners.find((b) => b.placement === "MIDDLE")
  const denimCarouselBanners = banners
    .filter((b) => b.placement === "DENIM_CAROUSEL")
    .sort((a, b) => a.position - b.position)
  const editorialBanners = banners
    .filter((b) => b.placement === "EDITORIAL")
    .sort((a, b) => a.position - b.position)
  const bottomBanner = banners.find((b) => b.placement === "BOTTOM")

  const normalizedQuery = query.trim().toLowerCase()

  const handleToggleActive = (id: string, currentActive: boolean) => {
    startTransition(async () => {
      const res = await updateBannerActiveAction(id, !currentActive)
      if (!res.success) {
        toast.error(res.message)
        return
      }
      setBanners((prev) =>
        prev.map((b) => (b.id === id ? { ...b, isActive: !currentActive } : b)),
      )
      toast.success(currentActive ? "Section deactivated." : "Section activated.")
      router.refresh()
    })
  }

  // Hero Drag & Drop
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

    const reordered = [...heroBanners]
    const [moved] = reordered.splice(draggedSlideIdx, 1)
    reordered.splice(targetIndex, 0, moved)

    const updatedWithPositions = reordered.map((item, idx) => ({
      ...item,
      position: idx,
    }))

    setBanners((prev) => {
      const others = prev.filter((b) => b.placement !== "HERO")
      return [...updatedWithPositions, ...others]
    })

    setDraggedSlideIdx(null)
    setDragOverSlideIdx(null)

    startTransition(async () => {
      const payload = updatedWithPositions.map((item) => ({
        id: item.id,
        position: item.position,
      }))
      const res = await reorderBannersAction({ items: payload })
      if (!res.success) {
        toast.error(res.message || "Failed to update slide order.")
        return
      }
      toast.success("Hero slide sequence updated.")
      router.refresh()
    })
  }

  const handleMoveSlideStep = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= heroBanners.length) return

    const reordered = [...heroBanners]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)

    const updatedWithPositions = reordered.map((item, idx) => ({
      ...item,
      position: idx,
    }))

    setBanners((prev) => {
      const others = prev.filter((b) => b.placement !== "HERO")
      return [...updatedWithPositions, ...others]
    })

    startTransition(async () => {
      const payload = updatedWithPositions.map((item) => ({
        id: item.id,
        position: item.position,
      }))
      const res = await reorderBannersAction({ items: payload })
      if (!res.success) {
        toast.error(res.message || "Failed to update slide order.")
        return
      }
      toast.success("Slide moved.")
      router.refresh()
    })
  }

  // Upload hero slides
  const handleUploadHeroSlides = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    if (files.length === 0) return

    setIsUploadingSlide(true)
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
          ctaLink: "/shop",
        })

        if (addRes.status === "success") {
          addedCount++
        }
      } catch {
        toast.error(`Error processing ${file.name}.`)
      }
    }

    setIsUploadingSlide(false)
    if (addedCount > 0) {
      toast.success(`Successfully added ${addedCount} slide(s) to Hero Carousel!`)
      router.refresh()
    }
  }

  // Carousel Drag & Drop
  const handleCarouselSlideDragStart = (index: number, e: React.DragEvent) => {
    setDraggedCarouselIdx(index)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", `${index}`)
  }

  const handleCarouselSlideDragOver = (index: number, e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    if (dragOverCarouselIdx !== index) {
      setDragOverCarouselIdx(index)
    }
  }

  const handleCarouselSlideDrop = (targetIndex: number, e: React.DragEvent) => {
    e.preventDefault()
    if (draggedCarouselIdx === null || draggedCarouselIdx === targetIndex) {
      setDraggedCarouselIdx(null)
      setDragOverCarouselIdx(null)
      return
    }

    const reordered = [...denimCarouselBanners]
    const [moved] = reordered.splice(draggedCarouselIdx, 1)
    reordered.splice(targetIndex, 0, moved)

    const updatedWithPositions = reordered.map((item, idx) => ({
      ...item,
      position: idx,
    }))

    setBanners((prev) => {
      const others = prev.filter((b) => b.placement !== "DENIM_CAROUSEL")
      return [...updatedWithPositions, ...others]
    })

    setDraggedCarouselIdx(null)
    setDragOverCarouselIdx(null)

    startTransition(async () => {
      const payload = updatedWithPositions.map((item) => ({
        id: item.id,
        position: item.position,
      }))
      const res = await reorderBannersAction({ items: payload })
      if (!res.success) {
        toast.error(res.message || "Failed to update carousel slide order.")
        return
      }
      toast.success("Carousel slide moved.")
      router.refresh()
    })
  }

  // Upload denim carousel slides
  const handleUploadCarouselSlides = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    if (files.length === 0) return

    setIsUploadingCarouselSlide(true)
    let addedCount = 0

    for (const file of files) {
      const allowed = new Set(["image/avif", "image/jpeg", "image/png", "image/webp"])
      if (!allowed.has(file.type)) {
        toast.error(`"${file.name}" is not a supported image (JPG, PNG, WebP, AVIF).`)
        continue
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`"${file.name}" is too large (max 10MB).`)
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
          toast.error(`Failed to upload ${file.name}.`)
          continue
        }

        const rawName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ")
        const formattedTitle = rawName.charAt(0).toUpperCase() + rawName.slice(1)

        const addRes = await addCarouselSlideAction({
          desktopImageKey: instruction.objectKey,
          title: formattedTitle,
          // The subtitle is the tile label on the site, so name files e.g. "Originals.jpg".
          subtitle: formattedTitle,
          ctaText: null,
          ctaLink: "/shop",
        })

        if (addRes.status === "success") {
          addedCount++
        }
      } catch {
        toast.error(`Error processing ${file.name}.`)
      }
    }

    setIsUploadingCarouselSlide(false)
    if (addedCount > 0) {
      toast.success(`Successfully added ${addedCount} slide(s) to Denim Carousel!`)
      router.refresh()
    }
  }

  const confirmDelete = () => {
    if (!bannersToDelete?.length) return
    const ids = bannersToDelete
    setBannersToDelete(null)
    startTransition(async () => {
      const res = await deleteBannersAction(ids)
      if (!res.success) {
        toast.error(res.message)
        return
      }
      setBanners((prev) => prev.filter((b) => !ids.includes(b.id)))
      toast.success(res.count === 1 ? "Slide deleted." : `${res.count} slides deleted.`)
      router.refresh()
    })
  }

  const matchesSearch = (text?: string | null) => {
    if (!normalizedQuery) return true
    return text?.toLowerCase().includes(normalizedQuery)
  }

  const heroVisibleSlides = heroBanners.filter(
    (s) =>
      !normalizedQuery ||
      matchesSearch(s.title) ||
      matchesSearch(s.subtitle) ||
      matchesSearch(s.ctaText) ||
      matchesSearch(s.ctaLink),
  )

  const carouselVisibleSlides = denimCarouselBanners.filter(
    (s) =>
      !normalizedQuery ||
      matchesSearch(s.title) ||
      matchesSearch(s.subtitle) ||
      matchesSearch(s.ctaText) ||
      matchesSearch(s.ctaLink),
  )

  return (
    <main className="min-h-full flex-1 bg-[#f9fafb] p-4 text-black sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Page Top Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-black text-white">
                <ImageIcon className="size-4" />
              </span>
              <h1 className="text-xl font-bold tracking-tight text-neutral-950">
                Homepage Visuals & Banners
              </h1>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Manage the hero carousel at the top of the Pubesto homepage. When no slide is active, the built-in slides are shown.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMediaLibraryOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3.5 text-xs font-semibold text-neutral-800 shadow-xs transition hover:bg-neutral-50 cursor-pointer"
            >
              <Cloud className="size-3.5 text-blue-600" />
              Cloudflare R2 Media
            </button>
            <Link
              href="/"
              target="_blank"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-neutral-800"
            >
              <ExternalLink className="size-3.5" />
              View Storefront
            </Link>
          </div>
        </div>

        {/* Quick Search and Overview Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-neutral-200/80 bg-white p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-600">
            <span className="flex size-5 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-bold text-white">
              5
            </span>
            <span>Homepage sections ordered top-to-bottom</span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter slides or links..."
              className="h-8 w-full rounded-lg border border-neutral-200 bg-neutral-50 pl-8 pr-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-black focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {/* The 7 Homepage Sections in visual order */}
        <div className="space-y-4">
          {/* ================================================================ */}
          {/* SECTION 1: HERO TOP CAROUSEL                                     */}
          {/* ================================================================ */}
          <section className="overflow-hidden rounded-xl border border-neutral-200/90 bg-white shadow-xs transition hover:border-neutral-300">
            <div className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {/* Left Info */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-black font-mono text-xs font-bold text-white shadow-2xs">
                    01
                  </div>

                  {/* Thumbnail Stack */}
                  <div className="relative aspect-[16/9] w-24 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-900 shadow-2xs">
                    {heroBanners[0]?.desktopImageUrl ? (
                      <BannerMediaPreview
                        src={heroBanners[0].desktopImageUrl}
                        alt="Hero Carousel"
                        sizes="96px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-white/50">
                        No image
                      </div>
                    )}
                    {heroBanners.length > 1 && (
                      <span className="absolute bottom-1 right-1 rounded bg-black/85 px-1 py-0.5 text-[9px] font-bold text-white">
                        +{heroBanners.length - 1}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-bold text-neutral-900">
                        Hero Header Slideshow
                      </h2>
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
                        {heroBanners.length} {heroBanners.length === 1 ? "Slide" : "Slides"}
                      </span>
                      <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                        Top of Page
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Full-screen auto-advancing slideshow greeting visitors at the very top.
                    </p>
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => heroUploadRef.current?.click()}
                    disabled={isUploadingSlide}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 shadow-2xs transition hover:bg-neutral-50 disabled:opacity-50 cursor-pointer"
                  >
                    {isUploadingSlide ? (
                      <>
                        <LoaderCircle className="size-3.5 animate-spin text-neutral-500" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="size-3.5 text-neutral-600" />
                        <span>Add Slide</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setHeroExpanded(!heroExpanded)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-xs font-semibold text-white shadow-2xs transition hover:bg-black cursor-pointer"
                  >
                    <span>{heroExpanded ? "Hide Slides" : `Manage Slides (${heroBanners.length})`}</span>
                    {heroExpanded ? (
                      <ChevronUp className="size-3.5" />
                    ) : (
                      <ChevronDown className="size-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Hidden file input for uploading slides into hero */}
              <input
                type="file"
                ref={heroUploadRef}
                multiple
                accept={[...BANNER_IMAGE_CONTENT_TYPES, ...BANNER_VIDEO_CONTENT_TYPES].join(",")}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    handleUploadHeroSlides(e.target.files)
                  }
                }}
              />
            </div>

            {/* Expanded Hero Slides Manager */}
            {heroExpanded && (
              <div className="border-t border-neutral-200/80 bg-neutral-50/70 p-4 sm:p-5">
                <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-200">
                    <div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="size-3.5 text-neutral-700" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                          Hero Slides ({heroBanners.length})
                        </h3>
                      </div>
                      <p className="mt-0.5 text-[11px] text-neutral-500">
                        Drag slides using the grip icon to change order. Click Edit to customize desktop/mobile photos or buttons.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isUploadingSlide}
                        onClick={() => heroUploadRef.current?.click()}
                        className="inline-flex h-7 items-center gap-1 rounded-md bg-black px-2.5 text-[11px] font-semibold text-white hover:bg-neutral-800 transition cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        <Plus className="size-3" /> Quick Upload
                      </button>
                      <Link
                        href="/dashboard/banners/new?placement=HERO"
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50 transition shadow-2xs"
                      >
                        <Pencil className="size-3" /> Custom Slide
                      </Link>
                    </div>
                  </div>

                  {heroVisibleSlides.length === 0 ? (
                    <div className="py-8 text-center text-xs text-neutral-500">
                      {normalizedQuery
                        ? "No slides match your search filter."
                        : "No slides yet. Click '+ Quick Upload' above to add slides."}
                    </div>
                  ) : (
                    <div className="divide-y divide-neutral-100 mt-2">
                      {heroVisibleSlides.map((slide, idx) => {
                        const isDragged = draggedSlideIdx === idx
                        const isDragOver =
                          dragOverSlideIdx === idx && draggedSlideIdx !== idx

                        return (
                          <div
                            key={slide.id}
                            draggable
                            onDragStart={(e) => handleSlideDragStart(idx, e)}
                            onDragOver={(e) => handleSlideDragOver(idx, e)}
                            onDrop={(e) => handleSlideDrop(idx, e)}
                            onDragEnd={() => {
                              setDraggedSlideIdx(null)
                              setDragOverSlideIdx(null)
                            }}
                            className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3 px-2 rounded-lg transition select-none ${
                              isDragged
                                ? "opacity-30 bg-neutral-100"
                                : isDragOver
                                  ? "bg-blue-50/70 border-t-2 border-t-blue-600 shadow-xs"
                                  : "hover:bg-neutral-50/80"
                            }`}
                          >
                            {/* Left: Reorder arrows, preview, title */}
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex items-center gap-1 text-neutral-400">
                                <span
                                  title="Drag to rearrange"
                                  className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:text-black transition-colors"
                                >
                                  <GripVertical className="size-4" />
                                </span>
                                <button
                                  type="button"
                                  disabled={idx === 0 || isPending}
                                  onClick={() => handleMoveSlideStep(idx, "up")}
                                  title="Move Up"
                                  className="p-1 rounded hover:bg-neutral-200 hover:text-black disabled:opacity-25 disabled:pointer-events-none cursor-pointer"
                                >
                                  <ArrowUp className="size-3" />
                                </button>
                                <span className="font-mono text-neutral-800 text-xs font-semibold min-w-[14px] text-center">
                                  {idx + 1}
                                </span>
                                <button
                                  type="button"
                                  disabled={idx === heroBanners.length - 1 || isPending}
                                  onClick={() => handleMoveSlideStep(idx, "down")}
                                  title="Move Down"
                                  className="p-1 rounded hover:bg-neutral-200 hover:text-black disabled:opacity-25 disabled:pointer-events-none cursor-pointer"
                                >
                                  <ArrowDown className="size-3" />
                                </button>
                              </div>

                              <Link
                                href={`/dashboard/banners/${slide.id}`}
                                className="group relative block aspect-[16/9] w-24 shrink-0 overflow-hidden rounded-md border border-neutral-200 bg-neutral-900 shadow-2xs"
                              >
                                <BannerMediaPreview
                                  src={slide.desktopImageUrl}
                                  alt={slide.title || `Slide ${idx + 1}`}
                                  sizes="96px"
                                  className="transition-transform group-hover:scale-105"
                                />
                                {slide.mobileImageUrl && (
                                  <span
                                    title="Has mobile portrait image"
                                    className="absolute bottom-0.5 right-0.5 flex size-4 items-center justify-center rounded bg-black/80 text-white"
                                  >
                                    <Smartphone className="size-2.5" />
                                  </span>
                                )}
                              </Link>

                              <div className="min-w-0">
                                <Link
                                  href={`/dashboard/banners/${slide.id}`}
                                  className="font-semibold text-xs text-neutral-900 hover:underline block truncate max-w-xs"
                                >
                                  {slide.title || (
                                    <span className="italic text-neutral-400 font-normal">
                                      (Visual slide without text)
                                    </span>
                                  )}
                                </Link>
                                <p className="text-[11px] text-neutral-500 truncate max-w-xs">
                                  {slide.subtitle || `Position ${idx + 1} in header rotation`}
                                </p>
                              </div>
                            </div>

                            {/* Middle: CTA link */}
                            <div className="hidden md:block min-w-44 text-left">
                              <p className="text-[11px] font-semibold text-neutral-800">
                                {slide.ctaText || "Clickable Slide"}
                              </p>
                              <p className="text-[10px] font-mono text-neutral-500 truncate max-w-[200px]">
                                {slide.ctaLink ? `→ ${slide.ctaLink}` : "No link"}
                              </p>
                            </div>

                            {/* Right: Actions */}
                            <div className="flex items-center gap-2 self-end sm:self-center">
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleToggleActive(slide.id, slide.isActive)}
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition cursor-pointer ${
                                  slide.isActive
                                    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60"
                                    : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 border border-neutral-200"
                                }`}
                              >
                                {slide.isActive ? "Active" : "Inactive"}
                              </button>

                              <Link
                                href={`/dashboard/banners/${slide.id}`}
                                title="Edit Slide"
                                className="inline-flex h-7 items-center gap-1 rounded border border-neutral-200 bg-white px-2 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50 transition shadow-2xs"
                              >
                                <Pencil className="size-3" /> Edit
                              </Link>

                              <button
                                type="button"
                                title="Delete Slide"
                                onClick={() => setBannersToDelete([slide.id])}
                                className="inline-flex size-7 items-center justify-center rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition cursor-pointer"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* The remaining sections belong to the original (Suos) homepage layout and are not
              shown on the Pubesto storefront, so they are hidden here. */}
          {SHOW_LEGACY_SECTIONS ? (<>
          {/* ================================================================ */}
          {/* SECTION 1B: SPLIT PAIR (2 IMAGES DIRECTLY BELOW HERO)            */}
          {/* ================================================================ */}
          <section className="overflow-hidden rounded-xl border border-neutral-200/90 bg-white shadow-xs transition hover:border-neutral-300">
            <div className="p-4 sm:p-5">
              <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-200 font-mono text-xs font-bold text-neutral-800 shadow-2xs">
                  01B
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-neutral-900">Split Pair</h2>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
                      2 Slots (Wide + Narrow)
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Two images side by side directly below the hero. Hidden on the site until both slots have an active image.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-200/80 bg-neutral-50/70 p-4 sm:p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { slotNum: 0, title: "Slot 1: Left (Wide)", ratio: "about 1760 × 1554" },
                  { slotNum: 1, title: "Slot 2: Right (Narrow)", ratio: "about 1120 × 1554" },
                ].map((slot) => {
                  const activeBanner = splitBanners.find((b) => b.position === slot.slotNum)

                  return (
                    <div
                      key={slot.slotNum}
                      className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-4 shadow-xs"
                    >
                      <div>
                        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                          <div>
                            <h3 className="text-xs font-bold text-neutral-900">{slot.title}</h3>
                            <span className="text-[10px] font-mono text-neutral-400">{slot.ratio}</span>
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                              activeBanner?.isActive
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                : "bg-neutral-100 text-neutral-500"
                            }`}
                          >
                            {activeBanner ? (activeBanner.isActive ? "Active" : "Hidden") : "Not set"}
                          </span>
                        </div>

                        <div className="mt-3 relative w-full aspect-video rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100">
                          {activeBanner?.desktopImageUrl ? (
                            <Image
                              src={activeBanner.desktopImageUrl}
                              alt={activeBanner.title || slot.title}
                              fill
                              sizes="320px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-400">
                              No image yet
                            </div>
                          )}
                        </div>

                        {activeBanner ? (
                          <p className="mt-2.5 font-mono text-[10px] text-neutral-400 truncate">
                            Link: {activeBanner.ctaLink || "none"}
                          </p>
                        ) : null}
                      </div>

                      <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
                        {activeBanner ? (
                          <>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleToggleActive(activeBanner.id, activeBanner.isActive)}
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition cursor-pointer ${
                                activeBanner.isActive
                                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60"
                                  : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 border border-neutral-200"
                              }`}
                            >
                              {activeBanner.isActive ? "Active" : "Hidden"}
                            </button>

                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/dashboard/banners/${activeBanner.id}`}
                                className="inline-flex h-7 items-center gap-1 rounded border border-neutral-200 bg-white px-2.5 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50 transition shadow-2xs"
                              >
                                <Pencil className="size-3" /> Edit Photo
                              </Link>
                              <button
                                type="button"
                                onClick={() => setBannersToDelete([activeBanner.id])}
                                title="Remove image"
                                className="inline-flex size-7 items-center justify-center rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition cursor-pointer"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          </>
                        ) : (
                          <Link
                            href={`/dashboard/banners/new?placement=SPLIT&position=${slot.slotNum}`}
                            className="w-full inline-flex h-7 items-center justify-center gap-1 rounded bg-black px-3 text-[11px] font-semibold text-white hover:bg-neutral-800 transition shadow-xs"
                          >
                            <Plus className="size-3" /> Upload Photo for Slot {slot.slotNum + 1}
                          </Link>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* ================================================================ */}
          {/* SECTION 2: FEATURE BANNER (BELOW LAUNCH OFFER, IMAGE OR VIDEO)   */}
          {/* ================================================================ */}
          <section className="overflow-hidden rounded-xl border border-neutral-200/90 bg-white shadow-xs transition hover:border-neutral-300">
            <div className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {/* Left Info */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-200 font-mono text-xs font-bold text-neutral-800 shadow-2xs">
                    02
                  </div>

                  <div className="relative aspect-[16/9] w-24 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-900 shadow-2xs">
                    {featureBanner?.desktopImageUrl ? (
                      <BannerMediaPreview
                        src={featureBanner.desktopImageUrl}
                        alt="Feature Banner"
                        sizes="96px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-white/50">
                        Not set
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-bold text-neutral-900">
                        Feature Banner
                      </h2>
                      <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-700">
                        Image or Video
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Full-width, fully clickable banner directly below Our Favourite.
                    </p>
                    {featureBanner?.ctaLink && (
                      <p className="mt-0.5 font-mono text-[10px] text-neutral-400 truncate max-w-xs">
                        Target link: {featureBanner.ctaLink}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {featureBanner ? (
                    <>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleToggleActive(featureBanner.id, featureBanner.isActive)}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                          featureBanner.isActive
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60"
                            : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 border border-neutral-200"
                        }`}
                      >
                        {featureBanner.isActive ? "Active (Visible)" : "Hidden"}
                      </button>

                      <Link
                        href={`/dashboard/banners/${featureBanner.id}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-800 shadow-2xs transition hover:bg-neutral-50"
                      >
                        <Pencil className="size-3.5" /> Edit Banner
                      </Link>
                    </>
                  ) : (
                    <Link
                      href="/dashboard/banners/new?placement=FEATURE"
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-black px-3.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-neutral-800"
                    >
                      <Plus className="size-3.5" /> Create Banner
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ================================================================ */}
          {/* SECTION 3: MIDDLE MOTION BANNER                                  */}
          {/* ================================================================ */}
          <section className="overflow-hidden rounded-xl border border-neutral-200/90 bg-white shadow-xs transition hover:border-neutral-300">
            <div className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {/* Left Info */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-200 font-mono text-xs font-bold text-neutral-800 shadow-2xs">
                    03
                  </div>

                  <div className="relative aspect-[16/9] w-24 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-900 shadow-2xs">
                    {middleBanner?.desktopImageUrl ? (
                      <BannerMediaPreview
                        src={middleBanner.desktopImageUrl}
                        alt="Middle Motion Banner"
                        sizes="96px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-white/50">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-bold text-neutral-900">
                        Middle Editorial Banner
                      </h2>
                      <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-700">
                        Mid-Page Break
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Full-width editorial visual displayed between product collections.
                    </p>
                    {middleBanner?.ctaLink && (
                      <p className="mt-0.5 font-mono text-[10px] text-neutral-400 truncate max-w-xs">
                        Target link: {middleBanner.ctaLink}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {middleBanner ? (
                    <>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleToggleActive(middleBanner.id, middleBanner.isActive)}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                          middleBanner.isActive
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60"
                            : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 border border-neutral-200"
                        }`}
                      >
                        {middleBanner.isActive ? "Active (Visible)" : "Hidden"}
                      </button>

                      <Link
                        href={`/dashboard/banners/${middleBanner.id}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-800 shadow-2xs transition hover:bg-neutral-50"
                      >
                        <Pencil className="size-3.5" /> Edit Banner
                      </Link>
                    </>
                  ) : (
                    <Link
                      href="/dashboard/banners/new?placement=MIDDLE"
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-black px-3.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-neutral-800"
                    >
                      <Plus className="size-3.5" /> Create Banner
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ================================================================ */}
          {/* SECTION 4: DENIM CAROUSEL (COLLECTION CUTOUTS)                   */}
          {/* ================================================================ */}
          <section className="overflow-hidden rounded-xl border border-neutral-200/90 bg-white shadow-xs transition hover:border-neutral-300">
            <div className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {/* Left Info */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-200 font-mono text-xs font-bold text-neutral-800 shadow-2xs">
                    04
                  </div>

                  <div className="relative aspect-[3/4] w-12 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 shadow-2xs">
                    {denimCarouselBanners[0]?.desktopImageUrl ? (
                      <Image
                        src={denimCarouselBanners[0].desktopImageUrl}
                        alt="Denim Carousel"
                        fill
                        sizes="48px"
                        className="object-contain"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[9px] text-neutral-400">
                        Default
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-bold text-neutral-900">
                        Denim Cut Showcase Carousel
                      </h2>
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
                        {denimCarouselBanners.length} {denimCarouselBanners.length === 1 ? "Slide" : "Slides"}
                      </span>
                      <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-700">
                        3 Collection Tiles
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      The first 3 slides show as tall tiles (about 960 × 1668 px). Each slide&apos;s subtitle is the label (e.g. Originals); without a link it opens /collections/&lt;label&gt;.
                    </p>
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => carouselUploadRef.current?.click()}
                    disabled={isUploadingCarouselSlide}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 shadow-2xs transition hover:bg-neutral-50 disabled:opacity-50 cursor-pointer"
                  >
                    {isUploadingCarouselSlide ? (
                      <>
                        <LoaderCircle className="size-3.5 animate-spin text-neutral-500" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="size-3.5 text-neutral-600" />
                        <span>Upload Slides</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setCarouselExpanded(!carouselExpanded)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-xs font-semibold text-white shadow-2xs transition hover:bg-black cursor-pointer"
                  >
                    <span>{carouselExpanded ? "Hide Slides" : `Manage Slides (${denimCarouselBanners.length})`}</span>
                    {carouselExpanded ? (
                      <ChevronUp className="size-3.5" />
                    ) : (
                      <ChevronDown className="size-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Hidden file input for uploading slides into carousel */}
              <input
                type="file"
                ref={carouselUploadRef}
                multiple
                accept="image/png,image/jpeg,image/webp,image/avif"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    handleUploadCarouselSlides(e.target.files)
                  }
                }}
              />
            </div>

            {/* Expanded Carousel Slides Manager */}
            {carouselExpanded && (
              <div className="border-t border-neutral-200/80 bg-neutral-50/70 p-4 sm:p-5">
                <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-200">
                    <div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="size-3.5 text-neutral-700" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                          Denim Carousel Slides ({denimCarouselBanners.length})
                        </h3>
                      </div>
                      <p className="mt-0.5 text-[11px] text-neutral-500">
                        {denimCarouselBanners.length === 0
                          ? "Using 5 default model cutouts on storefront. Upload custom transparent PNGs to personalize."
                          : "Drag items to reorder the infinite carousel. Click Edit to change the cut name or link."}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isUploadingCarouselSlide}
                        onClick={() => carouselUploadRef.current?.click()}
                        className="inline-flex h-7 items-center gap-1 rounded-md bg-black px-2.5 text-[11px] font-semibold text-white hover:bg-neutral-800 transition cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        <Plus className="size-3" /> Quick Upload
                      </button>
                      <Link
                        href="/dashboard/banners/new?placement=DENIM_CAROUSEL"
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50 transition shadow-2xs"
                      >
                        <Pencil className="size-3" /> Custom Slide
                      </Link>
                    </div>
                  </div>

                  {carouselVisibleSlides.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-xs text-neutral-500">
                        Storefront is currently displaying the 5 default cutout model slides.
                      </p>
                      <button
                        type="button"
                        onClick={() => carouselUploadRef.current?.click()}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-black px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800 cursor-pointer shadow-xs"
                      >
                        <Plus className="size-3.5" /> Upload First Slide
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-neutral-100 mt-2">
                      {carouselVisibleSlides.map((slide, idx) => (
                        <div
                          key={slide.id}
                          draggable
                          onDragStart={(e) => handleCarouselSlideDragStart(idx, e)}
                          onDragOver={(e) => handleCarouselSlideDragOver(idx, e)}
                          onDrop={(e) => handleCarouselSlideDrop(idx, e)}
                          className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-2.5 px-2 rounded-lg transition ${
                            dragOverCarouselIdx === idx
                              ? "bg-blue-50 border-2 border-dashed border-blue-400"
                              : "hover:bg-neutral-50"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="cursor-grab text-neutral-400 hover:text-black">
                              <GripVertical className="size-4" />
                            </span>
                            <span className="font-mono text-xs font-semibold text-neutral-500 w-4">
                              {idx + 1}
                            </span>
                            <div className="relative aspect-[3/4] w-12 shrink-0 overflow-hidden rounded border border-neutral-200 bg-neutral-100">
                              <Image
                                src={slide.desktopImageUrl}
                                alt={slide.title || "Slide"}
                                fill
                                sizes="48px"
                                className="object-contain"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-neutral-900 truncate max-w-[200px]">
                                {slide.title || "Untitled Slide"}
                              </p>
                              <p className="text-[10px] font-mono text-neutral-400 truncate max-w-[200px]">
                                {slide.ctaLink ? `→ ${slide.ctaLink}` : "No link"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleToggleActive(slide.id, slide.isActive)}
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition cursor-pointer ${
                                slide.isActive
                                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60"
                                  : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 border border-neutral-200"
                              }`}
                            >
                              {slide.isActive ? "Active" : "Inactive"}
                            </button>

                            <Link
                              href={`/dashboard/banners/${slide.id}`}
                              title="Edit Slide"
                              className="inline-flex h-7 items-center gap-1 rounded border border-neutral-200 bg-white px-2 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50 transition shadow-2xs"
                            >
                              <Pencil className="size-3" /> Edit
                            </Link>

                            <button
                              type="button"
                              title="Delete Slide"
                              onClick={() => setBannersToDelete([slide.id])}
                              className="inline-flex size-7 items-center justify-center rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition cursor-pointer"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ================================================================ */}
          {/* SECTION 5: EDITORIAL 3-PHOTO GRID                                */}
          {/* ================================================================ */}
          <section className="overflow-hidden rounded-xl border border-neutral-200/90 bg-white shadow-xs transition hover:border-neutral-300">
            <div className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {/* Left Info */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-200 font-mono text-xs font-bold text-neutral-800 shadow-2xs">
                    05
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-bold text-neutral-900">
                        Editorial 3-Photo Grid
                      </h2>
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
                        3 Slots (2 Square + 1 Wide)
                      </span>
                      <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-700">
                        Mid-Lower Grid
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Two square panels side-by-side followed by one wide banner underneath.
                    </p>
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditorialExpanded(!editorialExpanded)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-xs font-semibold text-white shadow-2xs transition hover:bg-black cursor-pointer"
                  >
                    <span>{editorialExpanded ? "Hide Slots" : "Manage 3 Slots"}</span>
                    {editorialExpanded ? (
                      <ChevronUp className="size-3.5" />
                    ) : (
                      <ChevronDown className="size-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Expanded 3 Slots */}
            {editorialExpanded && (
              <div className="border-t border-neutral-200/80 bg-neutral-50/70 p-4 sm:p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      slotNum: 0,
                      title: "Slot 1: Top-Left Square",
                      ratio: "1:1 Square (1024×1024)",
                      defaultImg: "/images/products/product6.png",
                      defaultDesc: "Model in denim sitting on chair",
                      banner: editorialBanners.find((b) => b.position === 0),
                    },
                    {
                      slotNum: 1,
                      title: "Slot 2: Top-Right Square",
                      ratio: "1:1 Square (1024×1024)",
                      defaultImg: "/images/products/product7.png",
                      defaultDesc: "Model in denim beside greenery",
                      banner: editorialBanners.find((b) => b.position === 1),
                    },
                    {
                      slotNum: 2,
                      title: "Slot 3: Bottom Wide Banner",
                      ratio: "20:9 Wide (2000×900)",
                      defaultImg: "/images/products/product8.png",
                      defaultDesc: "Panoramic horizontal denim banner",
                      banner: editorialBanners.find((b) => b.position === 2),
                    },
                  ].map((slot) => {
                    const activeBanner = slot.banner
                    const imgSrc = activeBanner?.desktopImageUrl || slot.defaultImg

                    return (
                      <div
                        key={slot.slotNum}
                        className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-4 shadow-xs"
                      >
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                            <div>
                              <h3 className="text-xs font-bold text-neutral-900">{slot.title}</h3>
                              <span className="text-[10px] font-mono text-neutral-400">{slot.ratio}</span>
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                                activeBanner
                                  ? activeBanner.isActive
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                    : "bg-neutral-100 text-neutral-500"
                                  : "bg-blue-50 text-blue-700"
                              }`}
                            >
                              {activeBanner ? (activeBanner.isActive ? "Custom Active" : "Hidden") : "Default"}
                            </span>
                          </div>

                          <div className="mt-3 relative w-full aspect-video rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100">
                            <Image
                              src={imgSrc}
                              alt={activeBanner?.title || slot.defaultDesc}
                              fill
                              sizes="260px"
                              className="object-cover"
                            />
                          </div>

                          <div className="mt-2.5">
                            <p className="text-xs font-semibold text-neutral-900 truncate">
                              {activeBanner?.title || slot.defaultDesc}
                            </p>
                            <p className="mt-0.5 font-mono text-[10px] text-neutral-400 truncate">
                              Link: {activeBanner?.ctaLink || "/collections"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
                          {activeBanner ? (
                            <>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleToggleActive(activeBanner.id, activeBanner.isActive)}
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition cursor-pointer ${
                                  activeBanner.isActive
                                    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60"
                                    : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 border border-neutral-200"
                                }`}
                              >
                                {activeBanner.isActive ? "Active" : "Hidden"}
                              </button>

                              <div className="flex items-center gap-1.5">
                                <Link
                                  href={`/dashboard/banners/${activeBanner.id}`}
                                  className="inline-flex h-7 items-center gap-1 rounded border border-neutral-200 bg-white px-2.5 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50 transition shadow-2xs"
                                >
                                  <Pencil className="size-3" /> Edit Photo
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => setBannersToDelete([activeBanner.id])}
                                  title="Reset slot to default"
                                  className="inline-flex size-7 items-center justify-center rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition cursor-pointer"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                            </>
                          ) : (
                            <Link
                              href={`/dashboard/banners/new?placement=EDITORIAL&position=${slot.slotNum}`}
                              className="w-full inline-flex h-7 items-center justify-center gap-1 rounded bg-black px-3 text-[11px] font-semibold text-white hover:bg-neutral-800 transition shadow-xs"
                            >
                              <Plus className="size-3" /> Upload Photo for Slot {slot.slotNum + 1}
                            </Link>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>

          {/* ================================================================ */}
          {/* SECTION 6: BOTTOM PRODUCT BANNER                                 */}
          {/* ================================================================ */}
          <section className="overflow-hidden rounded-xl border border-neutral-200/90 bg-white shadow-xs transition hover:border-neutral-300">
            <div className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {/* Left Info */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-200 font-mono text-xs font-bold text-neutral-800 shadow-2xs">
                    06
                  </div>

                  <div className="relative aspect-[16/9] w-24 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-900 shadow-2xs">
                    {bottomBanner?.desktopImageUrl ? (
                      <BannerMediaPreview
                        src={bottomBanner.desktopImageUrl}
                        alt="Bottom Product Banner"
                        sizes="96px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-white/50">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-bold text-neutral-900">
                        Bottom Craftsmanship Spotlight
                      </h2>
                      <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-700">
                        Pre-Footer Spotlight
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Brand craftsmanship and materials spotlight banner before the footer.
                    </p>
                    {bottomBanner?.ctaLink && (
                      <p className="mt-0.5 font-mono text-[10px] text-neutral-400 truncate max-w-xs">
                        Target link: {bottomBanner.ctaLink}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {bottomBanner ? (
                    <>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleToggleActive(bottomBanner.id, bottomBanner.isActive)}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                          bottomBanner.isActive
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60"
                            : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 border border-neutral-200"
                        }`}
                      >
                        {bottomBanner.isActive ? "Active (Visible)" : "Hidden"}
                      </button>

                      <Link
                        href={`/dashboard/banners/${bottomBanner.id}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-800 shadow-2xs transition hover:bg-neutral-50"
                      >
                        <Pencil className="size-3.5" /> Edit Banner
                      </Link>
                    </>
                  ) : (
                    <Link
                      href="/dashboard/banners/new?placement=BOTTOM"
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-black px-3.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-neutral-800"
                    >
                      <Plus className="size-3.5" /> Create Banner
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </section>
          </>) : null}
        </div>
      </div>

      {/* Media Library Dialog */}
      <BannerMediaLibraryDialog
        open={mediaLibraryOpen}
        onOpenChange={setMediaLibraryOpen}
        onSelectImage={async (img) => {
          setMediaLibraryOpen(false)
          startTransition(async () => {
            const addRes = await addHeroSlideAction({
              desktopImageKey: img.objectKey,
              title: null,
              subtitle: null,
              ctaText: null,
              ctaLink: "/shop",
            })
            if (addRes.status === "success") {
              toast.success("Slide added to Hero Carousel from library!")
              router.refresh()
            } else {
              toast.error(addRes.message || "Failed to add slide.")
            }
          })
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!bannersToDelete}
        onOpenChange={(open) => !open && setBannersToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete slide or banner?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this slide? If it is a default slot, it will revert to the default template image.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}

