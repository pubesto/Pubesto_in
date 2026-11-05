"use client"

import Image from "next/image"
import Link from "next/link"
import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  CirclePlus,
  Link2,
  LoaderCircle,
  Search,
  UploadCloud,
  X,
} from "lucide-react"
import { toast } from "sonner"

import {
  createCollectionAction,
  updateCollectionAction,
} from "@/app/actions/collections"
import { toAdminUppercase } from "@/lib/content-case"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import type {
  AdminCollectionEditor,
  AdminCollectionPageImage,
  AdminCollectionProduct,
} from "@/lib/server/dal/collections"

const inputClass =
  "h-10 w-full rounded-lg border border-black/25 bg-white px-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10"

type CollectionImage = {
  objectKey: string
  url: string | null
  altText: string | null
}

type FieldErrors = Record<string, string[] | undefined>

type UploadInstruction = {
  error?: string
  objectKey?: string
  uploadUrl?: string
  publicUrl?: string
}

async function readUploadInstruction(response: Response): Promise<UploadInstruction> {
  const body = await response.text()
  if (!body) return { error: "The upload service returned an empty response." }

  try {
    return JSON.parse(body) as UploadInstruction
  } catch {
    return { error: `The upload service returned an unexpected response (${response.status}).` }
  }
}

const ACCEPTED_IMAGE_TYPES = new Set(["image/avif", "image/jpeg", "image/png", "image/webp"])

/** Uploads one collection image and returns its storage key and preview URL. */
async function uploadCollectionImage(file: File) {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type) || file.size > 10 * 1024 * 1024) {
    throw new Error("Choose an AVIF, JPG, PNG, or WebP image up to 10 MB.")
  }

  const presignResponse = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      size: file.size,
      scope: "collection",
    }),
  })
  const presign = await readUploadInstruction(presignResponse)
  if (!presignResponse.ok || !presign.objectKey || !presign.uploadUrl || !presign.publicUrl) {
    throw new Error(presign.error || "The upload service is unavailable.")
  }

  const uploadResponse = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  })
  if (!uploadResponse.ok) throw new Error("The image could not be uploaded.")

  return { objectKey: presign.objectKey, url: presign.publicUrl }
}

/**
 * One storefront image on the collection page: preview, upload / replace,
 * alt text and an optional link. `controls` adds reorder buttons.
 */
function PageImageField({
  label,
  value,
  onChange,
  onRemove,
  controls,
  wide,
}: {
  label: string
  value: AdminCollectionPageImage | null
  onChange: (value: AdminCollectionPageImage) => void
  onRemove: () => void
  controls?: React.ReactNode
  wide?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setIsUploading(true)
    try {
      const uploaded = await uploadCollectionImage(file)
      onChange({ alt: value?.alt ?? "", href: value?.href ?? "", ...uploaded })
      toast.success("Image uploaded.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The image could not be uploaded.")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="grid gap-3 rounded-lg border border-black/10 bg-white p-3 sm:grid-cols-[160px_1fr]">
      <input
        ref={inputRef}
        type="file"
        accept="image/avif,image/jpeg,image/png,image/webp"
        onChange={handleFile}
        className="sr-only"
      />
      <button
        type="button"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
        aria-label={value?.url ? `Replace ${label}` : `Upload ${label}`}
        className={`relative grid w-full place-items-center overflow-hidden rounded-lg border border-dashed border-black/30 bg-black/[0.02] text-xs text-black/60 transition hover:bg-black/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:cursor-wait ${wide ? "aspect-[16/9]" : "aspect-[3/4]"}`}
      >
        {value?.url ? (
          <Image src={value.url} alt={value.alt || label} fill sizes="160px" className="object-cover" />
        ) : null}
        <span className={`relative inline-flex items-center gap-1.5 rounded-md px-2 py-1 ${value?.url ? "bg-white/90 text-black shadow-sm" : ""}`}>
          {isUploading ? <LoaderCircle className="size-3.5 animate-spin" /> : <UploadCloud className="size-3.5" />}
          {isUploading ? "Uploading" : value?.url ? "Replace" : "Upload"}
        </span>
      </button>

      <div className="grid content-start gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-black/80">{label}</span>
          <div className="flex items-center gap-1">
            {controls}
            {value ? (
              <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove ${label}`}
                className="grid size-7 place-items-center rounded-md text-black/55 transition hover:bg-black/[0.05] hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>
        {value ? (
          <>
            <label className="grid gap-1 text-xs text-black/65">
              <span>Alt text</span>
              <input
                value={value.alt}
                onChange={(event) => onChange({ ...value, alt: event.target.value })}
                maxLength={300}
                placeholder="Describe the photo"
                className={inputClass}
              />
            </label>
            <label className="grid gap-1 text-xs text-black/65">
              <span>Link (optional)</span>
              <input
                value={value.href}
                onChange={(event) => onChange({ ...value, href: event.target.value })}
                maxLength={500}
                placeholder="/products/... or /collections/..."
                className={inputClass}
              />
            </label>
          </>
        ) : (
          <span className="text-xs text-black/55">AVIF, JPG, PNG, or WebP up to 10 MB.</span>
        )}
      </div>
    </div>
  )
}

const iconButtonClass =
  "grid size-7 place-items-center rounded-md text-black/55 transition hover:bg-black/[0.05] hover:text-black disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 180)
}

function priceLabel(price: string | null) {
  if (!price) return "No variant price"

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(price))
}

function ProductThumbnail({ product }: { product: AdminCollectionProduct }) {
  if (!product.image?.url) {
    return (
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-black/[0.04] text-xs font-semibold text-black/45">
        {product.title.slice(0, 1).toUpperCase()}
      </span>
    )
  }

  return (
    <Image
      src={product.image.url}
      alt={product.image.altText || product.title}
      width={44}
      height={44}
      sizes="44px"
      className="size-11 shrink-0 rounded-lg border border-black/10 object-cover"
    />
  )
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-4">
        <h2 className="text-sm font-semibold text-black/80">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function CollectionEditor({
  collection,
  products,
}: {
  collection?: AdminCollectionEditor
  products: AdminCollectionProduct[]
}) {
  const router = useRouter()
  const imageInputRef = useRef<HTMLInputElement>(null)
  const isNew = !collection
  const [title, setTitle] = useState(toAdminUppercase(collection?.title ?? ""))
  const [description, setDescription] = useState(toAdminUppercase(collection?.description ?? ""))
  const [slug, setSlug] = useState(collection?.slug ?? "")
  const [isCustomSlug, setIsCustomSlug] = useState(Boolean(collection?.slug))
  const [isPublished, setIsPublished] = useState(collection?.isPublished ?? false)
  const [image, setImage] = useState<CollectionImage | null>(collection?.image ?? null)
  const [imageAltText, setImageAltText] = useState(
    toAdminUppercase(collection?.image?.altText ?? ""),
  )
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [editorialImages, setEditorialImages] = useState<AdminCollectionPageImage[]>(
    collection?.pageContent.editorialImages ?? [],
  )
  const [banner, setBanner] = useState<AdminCollectionPageImage | null>(
    collection?.pageContent.banner ?? null,
  )
  const [isSaved, setIsSaved] = useState(Boolean(collection))
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [productQuery, setProductQuery] = useState("")
  const [assignedProductIds, setAssignedProductIds] = useState<string[]>(
    () => collection?.products.map((product) => product.id) ?? [],
  )
  const [draftProductIds, setDraftProductIds] = useState<string[]>([])
  const [isSaving, startSaving] = useTransition()

  const productById = new Map(products.map((product) => [product.id, product]))
  const assignedProducts = assignedProductIds.flatMap((id) => {
    const product = productById.get(id)
    return product ? [product] : []
  })
  const normalizedProductQuery = productQuery.trim().toLowerCase()
  const pickerProducts = products.filter((product) =>
    !normalizedProductQuery ||
    [product.title, product.sku, product.status]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(normalizedProductQuery)),
  )
  const hasChanges = !isSaved

  const markChanged = () => {
    setIsSaved(false)
    setFormMessage(null)
  }

  const openPicker = () => {
    setDraftProductIds(assignedProductIds)
    setProductQuery("")
    setPickerOpen(true)
  }

  const toggleDraftProduct = (productId: string) => {
    setDraftProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    )
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setIsUploadingImage(true)
    try {
      const uploaded = await uploadCollectionImage(file)
      setImage({ ...uploaded, altText: imageAltText || null })
      markChanged()
      toast.success("Collection image uploaded.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The image could not be uploaded.")
    } finally {
      setIsUploadingImage(false)
    }
  }

  const saveCollection = () => {
    setFieldErrors({})
    setFormMessage(null)

    startSaving(async () => {
      const input = {
        title,
        slug,
        description,
        isPublished,
        imageObjectKey: image?.objectKey ?? null,
        imageAltText: image ? imageAltText || null : null,
        pageContent: {
          editorialImages: editorialImages.map(({ objectKey, alt, href }) => ({ objectKey, alt, href })),
          banner: banner ? { objectKey: banner.objectKey, alt: banner.alt, href: banner.href } : null,
        },
        productIds: assignedProductIds,
      }
      const result = collection
        ? await updateCollectionAction(collection.id, input)
        : await createCollectionAction(input)

      if (result.status === "error") {
        setFieldErrors(result.fields ?? {})
        setFormMessage(result.message)
        toast.error(result.message)
        return
      }

      setIsSaved(true)
      toast.success(isNew ? "Collection created." : "Collection saved.")
      router.replace("/dashboard/products/collections")
    })
  }

  return (
    <main className="min-h-full bg-[#f5f5f5] p-4 text-black sm:p-5">
      <div className="mx-auto max-w-[968px]">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-1.5 text-lg font-semibold">
              <Link2 className="size-4" />
              <ChevronRight className="size-4 text-black/45" />
              {isNew ? "Add collection" : "Edit collection"}
            </h1>
            {!isNew && hasChanges ? <p className="mt-1 text-xs text-black/55">Unsaved changes</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/products/collections"
              className="inline-flex h-9 items-center rounded-lg bg-black/[0.06] px-3 text-xs font-medium transition hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
            >
              Discard
            </Link>
            <button
              type="button"
              disabled={!title.trim() || isSaving || isUploadingImage}
              onClick={saveCollection}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-3 text-xs font-semibold text-white transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-black/15"
            >
              {isSaving ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
              {isSaving ? "Saving" : isSaved ? "Saved" : "Save"}
            </button>
          </div>
        </header>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_318px]">
          <div className="space-y-4">
            <SectionCard title="Collection information">
              <div className="space-y-4 px-4 pb-4">
                <label className="grid gap-1.5 text-sm text-black/75" htmlFor="collection-title">
                  <span>Title</span>
                  <input
                    id="collection-title"
                    value={title}
                    onChange={(event) => {
                      const nextTitle = toAdminUppercase(event.target.value)
                      setTitle(nextTitle)
                      if (!isCustomSlug) setSlug(slugify(nextTitle))
                      markChanged()
                    }}
                    aria-invalid={Boolean(fieldErrors.title)}
                    aria-describedby={fieldErrors.title ? "collection-title-error" : undefined}
                    placeholder="e.g. New arrivals"
                    className={`${inputClass} ${fieldErrors.title ? "border-red-500 focus:border-red-600 focus:ring-red-100" : ""}`}
                  />
                  {fieldErrors.title ? <span id="collection-title-error" className="text-xs text-red-600">{fieldErrors.title[0]}</span> : null}
                </label>

                <label className="grid gap-1.5 text-sm text-black/75" htmlFor="collection-description">
                  <span>Description</span>
                  <textarea
                    id="collection-description"
                    value={description}
                    onChange={(event) => {
                      setDescription(toAdminUppercase(event.target.value))
                      markChanged()
                    }}
                    rows={6}
                    maxLength={2_000}
                    placeholder="Describe this collection for customers and search engines"
                    className="w-full resize-none rounded-lg border border-black/25 bg-white p-3 text-sm leading-6 outline-none transition focus:border-black focus:ring-2 focus:ring-black/10"
                  />
                  <span className="text-right text-xs text-black/45">{description.length}/2000</span>
                </label>

                <div className="grid gap-1.5 text-sm text-black/75">
                  <span>Collection image</span>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/avif,image/jpeg,image/png,image/webp"
                    onChange={handleImageUpload}
                    className="sr-only"
                  />
                  <div className="rounded-lg border border-dashed border-black/35 bg-black/[0.01] p-3">
                    {image?.url ? (
                      <div role="list" aria-label="Collection media" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <div role="listitem" className="group relative aspect-square overflow-hidden rounded-lg border border-black/10 bg-black/[0.02]">
                          <Image
                            src={image.url}
                            alt={imageAltText || `${title || "Collection"} collection image`}
                            fill
                            sizes="176px"
                            className="object-cover"
                          />
                          <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">Cover image</span>
                          <button
                            type="button"
                            onClick={() => {
                              setImage(null)
                              setImageAltText("")
                              markChanged()
                            }}
                            aria-label="Remove collection image"
                            className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-md bg-white/95 text-black/65 shadow-sm transition hover:bg-white hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-28 flex-col items-center justify-center gap-2 text-center">
                        <button
                          type="button"
                          disabled={isUploadingImage}
                          onClick={() => imageInputRef.current?.click()}
                          className="inline-flex h-9 items-center gap-2 rounded-lg border border-black/15 bg-white px-3 text-sm font-medium transition hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isUploadingImage ? <LoaderCircle className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
                          {isUploadingImage ? "Uploading image" : "Upload image"}
                        </button>
                        <span className="text-xs text-black/55">AVIF, JPEG, PNG, or WebP — up to 10 MB</span>
                      </div>
                    )}
                  </div>
                  {image ? (
                    <label className="grid gap-1.5" htmlFor="collection-image-alt">
                      <span className="text-xs">Alt text</span>
                      <input
                        id="collection-image-alt"
                        value={imageAltText}
                        onChange={(event) => {
                          setImageAltText(toAdminUppercase(event.target.value))
                          markChanged()
                        }}
                        maxLength={300}
                        placeholder={`${title || "Collection"} image`}
                        className={inputClass}
                      />
                    </label>
                  ) : null}
                  <span className="text-xs text-black/55">The large image at the top of the collection page, also used on collection tiles. AVIF, JPG, PNG, or WebP up to 10 MB.</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Collection page images">
              <div className="grid gap-4 border-t border-black/10 p-4">
                <div className="grid gap-2">
                  <div>
                    <p className="text-sm font-medium text-black/80">Large photos in the product grid</p>
                    <p className="text-xs text-black/55">
                      The big photos placed between products, in this order (shown once the collection has 6 or more products). Leave empty to use product photos automatically. Up to 6.
                    </p>
                  </div>
                  {editorialImages.map((item, index) => (
                    <PageImageField
                      key={`${item.objectKey}-${index}`}
                      label={`Grid photo ${index + 1}`}
                      value={item}
                      onChange={(next) => {
                        setEditorialImages(editorialImages.map((current, j) => (j === index ? next : current)))
                        markChanged()
                      }}
                      onRemove={() => {
                        setEditorialImages(editorialImages.filter((_, j) => j !== index))
                        markChanged()
                      }}
                      controls={
                        <>
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => {
                              const next = [...editorialImages]
                              const swap = index + (-1)
                              ;[next[swap], next[index]] = [next[index], next[swap]]
                              setEditorialImages(next)
                              markChanged()
                            }}
                            aria-label={`Move grid photo ${index + 1} up`}
                            className={iconButtonClass}
                          >
                            <ArrowUp className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === editorialImages.length - 1}
                            onClick={() => {
                              const next = [...editorialImages]
                              const swap = index + (1)
                              ;[next[swap], next[index]] = [next[index], next[swap]]
                              setEditorialImages(next)
                              markChanged()
                            }}
                            aria-label={`Move grid photo ${index + 1} down`}
                            className={iconButtonClass}
                          >
                            <ArrowDown className="size-3.5" />
                          </button>
                        </>
                      }
                    />
                  ))}
                  {editorialImages.length < 6 ? (
                    <PageImageField
                      key={`new-${editorialImages.length}`}
                      label={editorialImages.length ? "Add another grid photo" : "Add a grid photo"}
                      value={null}
                      onChange={(next) => {
                        setEditorialImages([...editorialImages, next])
                        markChanged()
                      }}
                      onRemove={() => {}}
                    />
                  ) : null}
                </div>

                <div className="grid gap-2 border-t border-black/10 pt-4">
                  <div>
                    <p className="text-sm font-medium text-black/80">Bottom banner</p>
                    <p className="text-xs text-black/55">
                      The full-width photo near the bottom of the page, above the shipping strip. Leave empty to show another collection&apos;s image.
                    </p>
                  </div>
                  <PageImageField
                    label="Bottom banner"
                    wide
                    value={banner}
                    onChange={(next) => {
                      setBanner(next)
                      markChanged()
                    }}
                    onRemove={() => {
                      setBanner(null)
                      markChanged()
                    }}
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title={`Collection items (${assignedProducts.length})`}
              action={
                <button
                  type="button"
                  onClick={openPicker}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-black px-3 text-xs font-medium text-white transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                >
                  <CirclePlus className="size-3.5" /> Add products
                </button>
              }
            >
              <div className="border-t border-black/10">
                {assignedProducts.length ? (
                  <div className="divide-y divide-black/10">
                    {assignedProducts.map((product) => (
                      <div key={product.id} className="flex items-center gap-3 px-4 py-3">
                        <ProductThumbnail product={product} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{product.title}</p>
                          <p className="mt-0.5 text-xs text-black/55">{[product.sku, priceLabel(product.price), product.status.toLowerCase()].filter(Boolean).join(" · ")}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAssignedProductIds((current) => current.filter((id) => id !== product.id))
                            markChanged()
                          }}
                          className="rounded-md px-2 py-1 text-xs font-medium text-black/55 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-10 text-center">
                    <p className="text-sm font-medium">No products added yet</p>
                    <p className="mt-1 text-xs text-black/55">Add products to make this collection ready for customers.</p>
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Search engine listing">
              <div className="space-y-3 px-4 pb-4">
                <label className="grid gap-1.5 text-sm text-black/75" htmlFor="collection-slug">
                  <span>URL handle</span>
                  <span className="flex h-10 items-center overflow-hidden rounded-lg border border-black/25 bg-white transition focus-within:border-black focus-within:ring-2 focus-within:ring-black/10">
                    <span className="border-r border-black/10 px-3 text-sm text-black/45">/collections/</span>
                    <input
                      id="collection-slug"
                      value={slug}
                      onChange={(event) => {
                        setSlug(slugify(event.target.value))
                        setIsCustomSlug(true)
                        markChanged()
                      }}
                      placeholder="new-arrivals"
                      className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
                    />
                  </span>
                </label>
                <p className="text-xs text-black/55">Duplicate handles receive a unique suffix automatically when the collection is saved.</p>
              </div>
            </SectionCard>
          </div>

          <aside className="space-y-4">
            <SectionCard title="Status">
              <div className="px-4 pb-4">
                <label className="flex items-center justify-between gap-3 rounded-lg border border-black/10 px-3 py-2.5 text-sm">
                  <span>
                    <span className="block font-medium">Publish collection</span>
                    <span className="mt-0.5 block text-xs text-black/55">Make it available in the storefront.</span>
                  </span>
                  <Switch
                    checked={isPublished}
                    onCheckedChange={(checked) => {
                      setIsPublished(checked)
                      markChanged()
                    }}
                    aria-label="Toggle collection publication"
                  />
                </label>
              </div>
            </SectionCard>

            <SectionCard title="Collection summary">
              <div className="space-y-3 px-4 pb-4 text-sm">
                <div className="flex items-center justify-between"><span className="text-black/60">Products added</span><span className="font-semibold">{assignedProducts.length}</span></div>
                <div className="flex items-center justify-between"><span className="text-black/60">Storefront</span><span className="font-medium">{isPublished ? "Published" : "Draft"}</span></div>
                <div className="flex items-center justify-between"><span className="text-black/60">Cover image</span><span className="font-medium">{image ? "Added" : "None"}</span></div>
              </div>
            </SectionCard>
          </aside>
        </div>

        {formMessage ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{formMessage}</p> : null}
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:!w-[620px] sm:!max-w-[620px]" overlayClassName="bg-black/45 supports-backdrop-filter:backdrop-blur-[1px]">
          <DialogHeader className="border-b border-black/10 px-5 py-4">
            <DialogTitle className="text-base font-semibold">Add products</DialogTitle>
            <DialogDescription>Select the products that belong to this collection. A product can belong to multiple collections.</DialogDescription>
          </DialogHeader>
          <div className="border-b border-black/10 p-4">
            <label className="flex h-10 items-center gap-2 rounded-lg border border-black/20 bg-white px-3 text-sm text-black/55 transition focus-within:border-black focus-within:ring-2 focus-within:ring-black/10">
              <Search className="size-4" />
              <input autoFocus value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Search products" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-black/40" />
            </label>
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {pickerProducts.length ? pickerProducts.map((product) => (
              <label key={product.id} className="flex cursor-pointer items-center gap-3 border-b border-black/[0.08] px-4 py-2.5 transition hover:bg-black/[0.025]">
                <input type="checkbox" checked={draftProductIds.includes(product.id)} onChange={() => toggleDraftProduct(product.id)} className="size-4 rounded accent-black" />
                <ProductThumbnail product={product} />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{product.title}</span><span className="mt-0.5 block text-xs text-black/55">{[product.sku, priceLabel(product.price), product.status.toLowerCase()].filter(Boolean).join(" · ")}</span></span>
              </label>
            )) : <p className="px-4 py-10 text-center text-sm text-black/55">No products match your search.</p>}
          </div>
          <DialogFooter className="flex-row items-center justify-between border-t border-black/10 px-4 py-3 sm:justify-between">
            <span className="text-xs text-black/55">{draftProductIds.length} selected</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPickerOpen(false)} className="h-9 rounded-lg border border-black/15 px-3 text-sm font-medium transition hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black">Cancel</button>
              <button type="button" onClick={() => { setAssignedProductIds(draftProductIds); setPickerOpen(false); markChanged() }} className="h-9 rounded-lg bg-black px-3 text-sm font-medium text-white transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">Add products</button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
