"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import {
  Check,
  Cloud,
  Copy,
  ExternalLink,
  FolderOpen,
  LoaderCircle,
  Monitor,
  Plus,
  RefreshCw,
  Search,
  Smartphone,
  Sparkles,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import {
  addHeroSlideAction,
  createBannerAction,
  deleteStoredBannerImageAction,
  listStoredBannersAction,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { StoredBannerImage } from "@/lib/server/services/banners"

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return "Recent"
  }
}

export function BannerMediaLibraryDialog({
  open,
  onOpenChange,
  onSelectImage,
  initialTargetRole = "desktop",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectImage?: (
    image: { objectKey: string; url: string },
    targetRole?: "desktop" | "mobile",
  ) => void
  initialTargetRole?: "desktop" | "mobile"
}) {
  const router = useRouter()
  const [images, setImages] = useState<StoredBannerImage[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedImage, setSelectedImage] = useState<StoredBannerImage | null>(null)
  const [targetRole, setTargetRole] = useState<"desktop" | "mobile">(initialTargetRole)
  const [imageToDelete, setImageToDelete] = useState<StoredBannerImage | null>(null)
  const [isDeleting, startDeleting] = useTransition()
  const [isQuickPublishing, startQuickPublishing] = useTransition()

  const fetchImages = async () => {
    setLoading(true)
    try {
      const res = await listStoredBannersAction()
      if (res.success) {
        setImages(res.images)
        if (res.images.length > 0) {
          setSelectedImage((curr) => {
            if (curr) {
              const matched = res.images.find((i) => i.key === curr.key)
              return matched || res.images[0]
            }
            return res.images[0]
          })
        } else {
          setSelectedImage(null)
        }
      } else {
        toast.error(res.message || "Failed to load stored banners.")
      }
    } catch {
      toast.error("Error communicating with Cloudflare R2.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      setTargetRole(initialTargetRole)
      fetchImages()
    } else {
      setSelectedImage(null)
    }
  }, [open, initialTargetRole])

  const filteredImages = images.filter((img) => {
    if (!query.trim()) return true
    return img.key.toLowerCase().includes(query.trim().toLowerCase())
  })

  const totalBytes = images.reduce((acc, img) => acc + (img.size || 0), 0)

  // Apply or save process
  const handleApplySelection = (imageToApply = selectedImage, role = targetRole) => {
    if (!imageToApply) {
      toast.error("Please click or select an image first.")
      return
    }

    if (onSelectImage) {
      onSelectImage({ objectKey: imageToApply.key, url: imageToApply.url }, role)
      onOpenChange(false)
      toast.success(
        role === "desktop"
          ? "Desktop banner image selected & applied!"
          : "Mobile variant image selected & applied!",
      )
    } else {
      // In BannerManager overview: Navigate to Banner Editor with this image prefilled
      onOpenChange(false)
      const encodedKey = encodeURIComponent(imageToApply.key)
      const encodedUrl = encodeURIComponent(imageToApply.url)
      router.push(`/dashboard/banners/new?imageKey=${encodedKey}&imageUrl=${encodedUrl}`)
    }
  }

  // Quick-publish directly to Homepage without manual form fill
  const handleQuickPublishHero = (imageToPublish = selectedImage) => {
    if (!imageToPublish) {
      toast.error("Please click or select an image first.")
      return
    }

    startQuickPublishing(async () => {
      const res = await createBannerAction({
        desktopImageKey: imageToPublish.key,
        placement: "HERO",
        title: "NEW ARRIVALS",
        subtitle: "DISCOVER THE LATEST PIECES",
        ctaText: "EXPLORE COLLECTION",
        ctaLink: "/collections",
        isActive: true,
        textAlignment: "CENTER",
        overlayOpacity: 20,
      })

      if (res.status === "success") {
        toast.success("Image saved & published as Active Hero Banner on homepage!")
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error(res.message || "Failed to publish banner.")
      }
    })
  }

  // Add as a new slide in Hero Carousel directly
  const handleAddAsNewSlide = (imageToAdd = selectedImage) => {
    if (!imageToAdd) {
      toast.error("Please click or select an image first.")
      return
    }

    startQuickPublishing(async () => {
      const res = await addHeroSlideAction({
        desktopImageKey: imageToAdd.key,
        title: null,
        subtitle: null,
        ctaText: null,
        ctaLink: "/collections",
      })

      if (res.status === "success") {
        toast.success("Added as a new slide to Hero Carousel!")
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error(res.message || "Failed to add slide to carousel.")
      }
    })
  }

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    toast.success("Cloudflare R2 public URL copied to clipboard.")
  }

  const confirmDelete = () => {
    if (!imageToDelete) return
    const key = imageToDelete.key

    startDeleting(async () => {
      const res = await deleteStoredBannerImageAction(key)
      if (!res.success) {
        toast.error(res.message || "Could not delete image.")
        return
      }

      setImages((prev) => prev.filter((img) => img.key !== key))
      if (selectedImage?.key === key) {
        setSelectedImage(null)
      }
      setImageToDelete(null)
      toast.success("Image permanently removed from Cloudflare R2.")
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          style={{
            width: "80vw",
            maxWidth: "80vw",
            height: "80vh",
            maxHeight: "80vh",
          }}
          className="w-[80vw] max-w-[80vw] sm:w-[80vw] sm:max-w-[80vw] h-[80vh] max-h-[80vh] flex flex-col p-0 gap-0 overflow-hidden bg-white shadow-2xl rounded-2xl border border-black/15"
        >
          {/* Header */}
          <DialogHeader className="p-5 pb-4 border-b border-black/10 shrink-0 bg-neutral-50/70">
            <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
              <div>
                <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
                  <Cloud className="size-5 text-blue-600" /> Cloudflare R2 Banner Library
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-neutral-500">
                  Click any image to select and save it to your homepage, or delete unused files
                  from Cloudflare storage.
                </DialogDescription>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="text-xs font-mono text-neutral-600 bg-white border border-black/10 px-3 py-1.5 rounded-lg shadow-2xs">
                  {images.length} files • {formatBytes(totalBytes)}
                </span>
                <button
                  type="button"
                  onClick={fetchImages}
                  disabled={loading}
                  title="Refresh Cloudflare R2 list"
                  className="p-2 rounded-lg border border-black/15 bg-white text-neutral-700 hover:bg-neutral-100 transition disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* Search filter bar & Quick Target Selector */}
            <div className="mt-3.5 flex flex-wrap items-center gap-3">
              <label className="flex-1 min-w-[220px] flex h-9 items-center gap-2 rounded-lg border border-black/15 bg-white px-3 text-xs text-neutral-700 shadow-2xs focus-within:border-black focus-within:ring-1 focus-within:ring-black">
                <Search className="size-4 text-neutral-400 shrink-0" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter uploaded banners by filename or key..."
                  className="w-full bg-transparent outline-none placeholder:text-neutral-400 text-xs"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="text-xs text-neutral-400 hover:text-black font-semibold cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </label>

              {onSelectImage && (
                <div className="flex items-center rounded-lg border border-black/15 bg-neutral-100 p-0.5 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setTargetRole("desktop")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
                      targetRole === "desktop"
                        ? "bg-white text-black font-semibold shadow-2xs"
                        : "text-neutral-600 hover:text-black"
                    }`}
                  >
                    <Monitor className="size-3.5" /> Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetRole("mobile")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
                      targetRole === "mobile"
                        ? "bg-white text-black font-semibold shadow-2xs"
                        : "text-neutral-600 hover:text-black"
                    }`}
                  >
                    <Smartphone className="size-3.5" /> Mobile Variant
                  </button>
                </div>
              )}
            </div>
          </DialogHeader>

          {/* Gallery Grid (80% screen space gives plenty of room) */}
          <div className="flex-1 overflow-y-auto p-5 bg-[#fafafa]">
            {loading && images.length === 0 ? (
              <div className="py-28 flex flex-col items-center justify-center text-center">
                <LoaderCircle className="size-8 animate-spin text-neutral-600" />
                <p className="mt-3 text-sm text-neutral-600 font-medium">
                  Loading banner assets from Cloudflare R2...
                </p>
              </div>
            ) : filteredImages.length === 0 ? (
              <div className="py-24 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
                  <FolderOpen className="size-7" />
                </div>
                <h4 className="mt-4 text-base font-semibold text-neutral-900">
                  {images.length === 0
                    ? "No banners found in Cloudflare R2"
                    : "No banner images match your search"}
                </h4>
                <p className="mt-1 text-xs text-neutral-500 max-w-md mx-auto">
                  {images.length === 0
                    ? "Upload your first banner from the editor. Any uploaded images will automatically appear in this Cloudflare library for quick reuse and deletion."
                    : "Try searching with a different filename or clearing the search box."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {filteredImages.map((img, idx) => {
                  const isSelected = selectedImage?.key === img.key
                  const bannerUsage = img.inUseBy && img.inUseBy.length > 0 ? img.inUseBy[0] : null
                  
                  // Human-friendly title: prefer banner title if in use, else clean asset label
                  const friendlyTitle = bannerUsage?.title?.trim()
                    ? bannerUsage.title
                    : `Visual Asset #${idx + 1}`

                  const placementLabel = bannerUsage
                    ? bannerUsage.placement === "HERO"
                      ? "Hero Carousel"
                      : bannerUsage.placement === "SPLIT"
                        ? "Split Pair"
                      : bannerUsage.placement === "FEATURE"
                        ? "Feature Banner"
                        : bannerUsage.placement === "MIDDLE"
                          ? "Middle Motion"
                          : bannerUsage.placement === "EDITORIAL"
                            ? "Editorial Grid"
                            : bannerUsage.placement === "DENIM_CAROUSEL"
                              ? "Denim Carousel"
                              : "Bottom Banner"
                    : null

                  return (
                    <div
                      key={img.key}
                      onClick={() => setSelectedImage(img)}
                      onDoubleClick={() => handleApplySelection(img, targetRole)}
                      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-white transition-all cursor-pointer select-none ${
                        isSelected
                          ? "ring-2 ring-black border-black shadow-lg"
                          : "border-black/10 hover:border-black/30 hover:shadow-md"
                      }`}
                    >
                      {/* Image Thumbnail with clean 16:9 ratio */}
                      <div className="relative aspect-[16/9] w-full bg-neutral-900 overflow-hidden">
                        <Image
                          src={img.url}
                          alt={friendlyTitle}
                          fill
                          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 240px"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />

                        {/* Top Gradient for badge readability */}
                        <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />

                        {/* Selection checkmark badge */}
                        {isSelected ? (
                          <div className="absolute top-2 left-2 z-10 flex size-6 items-center justify-center rounded-full bg-black text-white shadow-md">
                            <Check className="size-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="absolute top-2 left-2 z-10 size-5 rounded-full border-2 border-white/80 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}

                        {/* Usage Pill Badge */}
                        <div className="absolute top-2 right-2 z-10">
                          {bannerUsage ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-black/80 backdrop-blur-xs px-2 py-0.5 text-[10px] font-medium text-white shadow-xs">
                              <span className="size-1.5 rounded-full bg-emerald-400" />
                              {placementLabel}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-white/90 backdrop-blur-xs px-2 py-0.5 text-[10px] font-medium text-neutral-700 shadow-xs">
                              Unused
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Content - Clean, readable, no ugly UUIDs */}
                      <div className="p-3 flex flex-col justify-between flex-1 gap-2">
                        <div>
                          <h4 className="text-xs font-semibold text-neutral-900 truncate" title={friendlyTitle}>
                            {friendlyTitle}
                          </h4>
                          <p className="text-[11px] text-neutral-400 mt-0.5">
                            {formatBytes(img.size)} • {formatDate(img.lastModified)}
                          </p>
                        </div>

                        {/* Quick Selection State / Button */}
                        <div className="pt-1 border-t border-black/5 flex items-center justify-between">
                          <span
                            className={`text-[11px] font-medium transition-colors ${
                              isSelected ? "text-black font-semibold" : "text-neutral-500 group-hover:text-neutral-900"
                            }`}
                          >
                            {isSelected ? "Selected ✓" : "Click to select"}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleApplySelection(img, targetRole)
                            }}
                            className={`rounded-md px-2 py-1 text-[11px] font-semibold transition cursor-pointer ${
                              isSelected
                                ? "bg-black text-white hover:bg-neutral-800"
                                : "bg-neutral-100 text-neutral-700 hover:bg-black hover:text-white"
                            }`}
                          >
                            Use Image
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Bottom Docked Selection Action Bar */}
          <div className="p-4 px-6 border-t border-black/10 bg-white shrink-0 flex flex-wrap items-center justify-between gap-4">
            {selectedImage ? (
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="relative size-12 shrink-0 rounded-lg overflow-hidden border border-black/15 bg-neutral-900 shadow-2xs">
                  <Image
                    src={selectedImage.url}
                    alt="Selected preview"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-neutral-900 truncate">
                      {selectedImage.inUseBy?.[0]?.title || "Selected Visual Asset"}
                    </p>
                    <span className="rounded bg-black px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      Selected
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    {formatBytes(selectedImage.size)} • {formatDate(selectedImage.lastModified)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-neutral-500 italic flex items-center gap-1.5">
                <span>👆</span> Click or select any image above to proceed with the save process.
              </p>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2.5 ml-auto">
              {selectedImage && (
                <>
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(selectedImage.url)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-black/15 bg-white px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition cursor-pointer shadow-2xs"
                  >
                    <Copy className="size-3.5" /> Copy CDN URL
                  </button>

                  <button
                    type="button"
                    onClick={() => setImageToDelete(selectedImage)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/70 px-3 text-xs font-medium text-red-700 hover:bg-red-100 transition cursor-pointer shadow-2xs"
                  >
                    <Trash2 className="size-3.5" /> Delete from R2
                  </button>
                </>
              )}

              {onSelectImage ? (
                /* Opened from Banner Editor */
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!selectedImage || isQuickPublishing}
                    onClick={() => handleAddAsNewSlide(selectedImage)}
                    title="Add this image as an additional slide to your homepage Hero carousel instead of replacing current slide"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-black/20 bg-white px-3 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                  >
                    {isQuickPublishing ? (
                      <LoaderCircle className="size-3.5 animate-spin" />
                    ) : (
                      <Plus className="size-3.5" />
                    )}
                    + Add as New Hero Slide
                  </button>

                  <button
                    type="button"
                    disabled={!selectedImage}
                    onClick={() => handleApplySelection(selectedImage, targetRole)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-4 text-xs font-semibold text-white hover:bg-neutral-800 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                  >
                    <Check className="size-4 stroke-[2.5]" />
                    {targetRole === "mobile"
                      ? "Replace Mobile Image"
                      : "Replace Desktop Image"}
                  </button>
                </div>
              ) : (
                /* Opened from Banner Manager overview */
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!selectedImage || isQuickPublishing}
                    onClick={() => handleQuickPublishHero(selectedImage)}
                    title="Publish immediately as active hero banner on homepage"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                  >
                    {isQuickPublishing ? (
                      <LoaderCircle className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5 text-purple-600" />
                    )}
                    Quick Publish to Hero
                  </button>

                  <button
                    type="button"
                    disabled={!selectedImage}
                    onClick={() => handleApplySelection(selectedImage)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-4 text-xs font-semibold text-white hover:bg-neutral-800 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                  >
                    <Plus className="size-4" /> Create & Configure Banner
                  </button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Permanent Cloudflare Deletion */}
      <AlertDialog
        open={Boolean(imageToDelete)}
        onOpenChange={(open) => {
          if (!open) setImageToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="size-4" /> Delete from Cloudflare R2?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-neutral-600">
              You are about to permanently delete the file{" "}
              <span className="font-mono font-semibold text-black">
                {imageToDelete?.key.split("/").pop()}
              </span>{" "}
              from your Cloudflare R2 storage bucket.
              {imageToDelete?.inUseBy?.length ? (
                <span className="block mt-2 font-medium text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  ⚠️ Caution: This image is currently in use by active banners (
                  {imageToDelete.inUseBy.map((b) => b.title || "Banner").join(", ")}). Deleting it
                  will safely revert those banners to default brand images.
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={confirmDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <LoaderCircle className="size-3.5 animate-spin mr-1" /> Deleting...
                </>
              ) : (
                "Delete from R2"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
