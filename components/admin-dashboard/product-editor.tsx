"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useRef, useState, useTransition } from "react"
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  GripVertical,
  ImagePlus,
  LoaderCircle,
  Pencil,
  Receipt,
  Tag,
  Trash2,
  UploadCloud,
} from "lucide-react"
import { toast } from "sonner"

import { createProductAction, duplicateProductAction, updateProductAction } from "@/app/actions/products"
import { toAdminUppercase } from "@/lib/content-case"
import {
  ProductAdditionalDetailsSection,
  type ProductDetailDraft,
} from "@/components/admin-dashboard/product-additional-details-section"
import { ProductOrganizationFields } from "@/components/admin-dashboard/product-organization-fields"
import { ProductStorefrontSection } from "@/components/admin-dashboard/product-storefront-section"
import {

  type DiscountCodeOption,
  type ProductOption,
} from "@/components/admin-dashboard/product-page-content-section"
import {
  emptyProductPageContent,
  type ProductPageContent,
} from "@/lib/product-page-content"
import {
  ProductVariantsSection,
  type ProductVariantDraft,
} from "@/components/admin-dashboard/product-variants-section"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AdminCategoryOption } from "@/lib/server/dal/categories"
import type { AdminCollectionOption } from "@/lib/server/dal/products"

const inputClass =
  "h-10 w-full rounded-lg border border-black/25 bg-white px-3 text-sm outline-none transition placeholder:text-black/40 focus:border-black focus:ring-2 focus:ring-black/10 aria-invalid:border-red-700 aria-invalid:ring-red-100"

type FieldErrors = Record<string, string[] | undefined>

export type ProductEditorImage = {
  objectKey: string
  url: string | null
  name: string
  altText?: string
}

export type ProductEditorInitialProduct = {
  id: string
  title: string
  description: string
  slug: string
  status: "ACTIVE" | "DRAFT"
  categoryId: string
  collectionIds: string[]
  tags: string[]
  price: string
  compareAtPrice: string
  inventoryQuantity: string
  sku: string
  images: ProductEditorImage[]
  variants: ProductVariantDraft[]
  details: ProductDetailDraft[]
  pageContent?: ProductPageContent
  taxRate?: string
  hsnCode?: string
  isTaxExempt?: boolean
}

type UploadInstruction = {
  error?: string
  objectKey?: string
  uploadUrl?: string
  publicUrl?: string
}

function Card({
  title,
  children,
  actions,
  className = "",
}: {
  title: string
  children: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <section className={`overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm ${className}`}>
      {title ? (
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <h2 className="text-sm font-semibold text-black/80">{title}</h2>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  )
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180)
}

async function readUploadInstruction(response: Response): Promise<UploadInstruction> {
  const body = await response.text()

  if (!body) {
    return { error: "The upload service returned an empty response." }
  }

  try {
    return JSON.parse(body) as UploadInstruction
  } catch {
    return { error: "The upload service returned an unexpected response." }
  }
}

function errorFor(errors: FieldErrors, key: string) {
  return errors[key]?.[0]
}

export function ProductEditor({
  categories,
  collections,
  productOptions = [],
  discountCodes = [],
  initialProduct,
}: {
  categories: AdminCategoryOption[]
  collections: AdminCollectionOption[]
  productOptions?: ProductOption[]
  discountCodes?: DiscountCodeOption[]
  initialProduct?: ProductEditorInitialProduct
}) {
  const router = useRouter()
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState(toAdminUppercase(initialProduct?.title ?? ""))
  const [description, setDescription] = useState(initialProduct?.description ?? "")
  const [slug, setSlug] = useState(initialProduct?.slug ?? "")
  const [isCustomSlug, setIsCustomSlug] = useState(Boolean(initialProduct))
  const [seoExpanded, setSeoExpanded] = useState(false)
  const [status, setStatus] = useState<"ACTIVE" | "DRAFT">(initialProduct?.status ?? "ACTIVE")
  const [categoryId, setCategoryId] = useState(initialProduct?.categoryId ?? "")
  const [collectionIds, setCollectionIds] = useState<string[]>(initialProduct?.collectionIds ?? [])
  const [tags, setTags] = useState<string[]>(() =>
    (initialProduct?.tags ?? []).map(toAdminUppercase),
  )
  const [price, setPrice] = useState(initialProduct?.price ?? "0.00")
  const [compareAtPrice, setCompareAtPrice] = useState(initialProduct?.compareAtPrice ?? "")
  const [inventoryQuantity, setInventoryQuantity] = useState(initialProduct?.inventoryQuantity ?? "0")
  const [sku, setSku] = useState(initialProduct?.sku ?? "")
  const [images, setImages] = useState<ProductEditorImage[]>(initialProduct?.images ?? [])
  const [draggedImageKey, setDraggedImageKey] = useState<string | null>(null)
  const [dropImageKey, setDropImageKey] = useState<string | null>(null)
  const [variants, setVariants] = useState<ProductVariantDraft[]>(initialProduct?.variants ?? [])
  const [taxRate, setTaxRate] = useState<number>(initialProduct?.taxRate ? Number(initialProduct.taxRate) : 12)
  const [hsnCode, setHsnCode] = useState<string>(initialProduct?.hsnCode ?? "")
  const [isTaxExempt, setIsTaxExempt] = useState<boolean>(initialProduct?.isTaxExempt ?? false)
  const [details, setDetails] = useState<ProductDetailDraft[]>(() =>
    (initialProduct?.details ?? []).map((detail) => ({
      name: toAdminUppercase(detail.name),
      value: detail.value,
    })),
  )
  const [pageContent, setPageContent] = useState<ProductPageContent>(
    initialProduct?.pageContent ?? emptyProductPageContent,
  )
  const [imageAlts, setImageAlts] = useState<Record<string, string>>(() =>
    Object.fromEntries((initialProduct?.images ?? []).map((image) => [image.objectKey, image.altText ?? ""])),
  )
  const [isDuplicating, startDuplicating] = useTransition()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()

  const effectiveSlug = slug || slugify(title)

  const markChanged = () => {
    setFormMessage(null)
  }

  const updateTitle = (value: string) => {
    const nextTitle = toAdminUppercase(value)
    setTitle(nextTitle)
    if (!isCustomSlug) {
      setSlug(slugify(nextTitle))
    }
    markChanged()
  }

  const handleVariantsChange = useCallback((nextVariants: ProductVariantDraft[]) => {
    setVariants(nextVariants)
    markChanged()
  }, [])

  // Swatch colors come from the variant editor; saved with the page content.
  const handleSwatchesChange = useCallback((colorSwatches: Record<string, string>) => {
    setPageContent((current) =>
      JSON.stringify(current.colorSwatches) === JSON.stringify(colorSwatches)
        ? current
        : { ...current, colorSwatches },
    )
  }, [])

  const handleDetailsChange = useCallback((nextDetails: ProductDetailDraft[]) => {
    setDetails(nextDetails)
    markChanged()
  }, [])

  async function uploadImage(file: File): Promise<ProductEditorImage> {
    const presignResponse = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        size: file.size,
        scope: "product",
      }),
    })
    const instruction = await readUploadInstruction(presignResponse)

    if (!presignResponse.ok || !instruction.objectKey || !instruction.uploadUrl || !instruction.publicUrl) {
      throw new Error(instruction.error || "Could not prepare this image for upload.")
    }

    const uploadResponse = await fetch(instruction.uploadUrl, {
      method: "PUT",
      headers: { "content-type": file.type },
      body: file,
    })

    if (!uploadResponse.ok) {
      throw new Error("The image upload failed. Please try again.")
    }

    return {
      objectKey: instruction.objectKey,
      url: instruction.publicUrl,
      name: file.name,
    }
  }

  async function handleImageSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""

    if (files.length === 0) {
      return
    }

    const availableSlots = 20 - images.length
    const imagesToUpload = files.slice(0, availableSlots)
    const invalidFile = imagesToUpload.find(
      (file) => !["image/avif", "image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024,
    )

    if (invalidFile) {
      setUploadMessage("Use AVIF, JPEG, PNG, or WebP images up to 10 MB each.")
      return
    }

    setIsUploading(true)
    setUploadMessage(null)
    try {
      const uploaded = await Promise.all(imagesToUpload.map(uploadImage))
      setImages((current) => [...current, ...uploaded])
      if (files.length > imagesToUpload.length) {
        setUploadMessage("Only the first 20 product images can be saved.")
      }
      markChanged()
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "The image upload failed. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  function removeImage(objectKey: string) {
    setImages((current) => current.filter((image) => image.objectKey !== objectKey))
    markChanged()
  }

  function reorderImages(sourceKey: string, targetKey: string) {
    if (sourceKey === targetKey) {
      return
    }

    setImages((current) => {
      const source = current.find((image) => image.objectKey === sourceKey)
      if (!source) {
        return current
      }

      const next = current.filter((image) => image.objectKey !== sourceKey)
      const targetIndex = next.findIndex((image) => image.objectKey === targetKey)
      if (targetIndex < 0) {
        return current
      }
      next.splice(targetIndex, 0, source)
      return next
    })
    markChanged()
  }

  function moveImage(objectKey: string, direction: -1 | 1) {
    setImages((current) => {
      const sourceIndex = current.findIndex((image) => image.objectKey === objectKey)
      const targetIndex = sourceIndex + direction
      if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= current.length) {
        return current
      }

      const next = [...current]
      const [image] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, image)
      return next
    })
    markChanged()
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFieldErrors({})
    setFormMessage(null)

    if (title.trim().length < 2) {
      setFieldErrors({ title: ["Enter a product title with at least 2 characters."] })
      setFormMessage("Check the highlighted product fields.")
      return
    }

    if (isUploading) {
      setFormMessage("Wait for image uploads to finish before saving.")
      return
    }

    const completeDetails = details.filter((detail) => detail.name.trim() || detail.value.trim())
    if (completeDetails.some((detail) => !detail.name.trim() || !detail.value.trim())) {
      setFieldErrors({ details: ["Complete or remove each additional detail."] })
      setFormMessage("Check the highlighted product fields.")
      return
    }

    startSaving(async () => {
      const input = {
        title,
        slug: effectiveSlug || undefined,
        description,
        status,
        categoryId: categoryId || null,
        collectionIds,
        tags,
        price,
        compareAtPrice,
        inventoryQuantity,
        sku,
        images: images.map((image) => image.objectKey),
        variants,
        details: completeDetails,
        pageContent: {
          ...pageContent,
          // Drop picks of images that were removed from Media before saving.
          highlights: pageContent.highlights.map((highlight) => ({
            ...highlight,
            imageKey: images.some((image) => image.objectKey === highlight.imageKey) ? highlight.imageKey : "",
          })),
          lifestyleImageKey: images.some((image) => image.objectKey === pageContent.lifestyleImageKey)
            ? pageContent.lifestyleImageKey
            : "",
          hoverImageKey: images.some((image) => image.objectKey === pageContent.hoverImageKey)
            ? pageContent.hoverImageKey
            : "",
          imageRoles: Object.fromEntries(
            Object.entries(pageContent.imageRoles).filter(([key]) => images.some((image) => image.objectKey === key)),
          ),
          highlightStrip: pageContent.highlightStrip.filter((tile) => tile.title.trim() || tile.text.trim()),
          colorImages: Object.fromEntries(
            Object.entries(pageContent.colorImages).filter(
              ([color, key]) => key && color in pageContent.colorSwatches && images.some((image) => image.objectKey === key),
            ),
          ),
        },
        imageAltTexts: Object.fromEntries(
          images.map((image) => [image.objectKey, (imageAlts[image.objectKey] ?? "").trim()]),
        ),
        taxRate,
        hsnCode,
        isTaxExempt,
      }
      const result = initialProduct
        ? await updateProductAction(initialProduct.id, input)
        : await createProductAction(input)

      if (result.status === "error") {
        setFieldErrors(result.fields ?? {})
        const fieldErrorMessages = Object.entries(result.fields ?? {})
          .flatMap(([field, errors]) => errors.map((e) => `${field}: ${e}`))
          .join(" | ")
        setFormMessage(
          fieldErrorMessages ? `${result.message} (${fieldErrorMessages})` : result.message,
        )
        return
      }

      toast.success(initialProduct ? "Product updated" : "Product created")
      router.replace("/dashboard/products")
    })
  }

  return (
    <main className="min-h-full bg-[#f5f5f5] p-4 text-black sm:p-5">
      <form onSubmit={handleSubmit} className="mx-auto max-w-[968px]">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Tag className="size-4" />
            <ChevronRight className="size-4 text-black/45" />
            {initialProduct ? "Edit product" : "Add product"}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {initialProduct ? (
              <>
                <a
                  href={`/product/${initialProduct.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Opens the saved version (save first to see new changes)"
                  className="inline-flex h-9 items-center rounded-lg border border-black/15 bg-white px-3 text-sm font-medium text-black/75 transition hover:bg-black/[0.03]"
                >
                  Preview
                </a>
                <button
                  type="button"
                  disabled={isDuplicating || isSaving}
                  onClick={() =>
                    startDuplicating(async () => {
                      const result = await duplicateProductAction(initialProduct.id)
                      if (!result.success) {
                        toast.error(result.message)
                        return
                      }
                      toast.success("Duplicated as a Draft. Add its photos, then set it to Active.")
                      router.push(`/dashboard/products/${result.productId}`)
                    })
                  }
                  className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-black/15 bg-white px-3 text-sm font-medium text-black/75 transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDuplicating ? <LoaderCircle className="size-4 animate-spin" /> : null}
                  Duplicate
                </button>
              </>
            ) : null}
            <Link
              href="/dashboard/products"
              className="inline-flex h-9 items-center rounded-lg bg-black/[0.06] px-3 text-sm font-medium text-black/75 transition hover:bg-black/10"
            >
              Discard
            </Link>
            <button
              type="submit"
              disabled={isSaving || isUploading}
              className="inline-flex h-9 min-w-20 cursor-pointer items-center justify-center gap-2 rounded-lg bg-black px-4 text-sm font-semibold text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/20"
            >
              {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {isSaving ? "Saving" : isUploading ? "Uploading" : "Save"}
            </button>
          </div>
        </header>

        {formMessage ? (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {formMessage}
          </p>
        ) : null}

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_318px]">
          <div>
            <Card title="">
              <div className="space-y-4 px-4 pb-4 pt-4">
                <label className="grid gap-1.5 text-sm text-black/75" htmlFor="product-title">
                  <span>Title</span>
                  <input
                    id="product-title"
                    value={title}
                    onChange={(event) => updateTitle(event.target.value)}
                    placeholder="Short sleeve t-shirt"
                    aria-invalid={Boolean(errorFor(fieldErrors, "title"))}
                    className={inputClass}
                  />
                  {errorFor(fieldErrors, "title") ? <span className="text-xs text-red-700">{errorFor(fieldErrors, "title")}</span> : null}
                </label>

                <label className="grid gap-1.5 text-sm text-black/75" htmlFor="product-description">
                  <span>Description</span>
                  <textarea
                    id="product-description"
                    value={description}
                    onChange={(event) => { setDescription(event.target.value); markChanged() }}
                    placeholder="Write a product description"
                    rows={6}
                    className="w-full resize-y rounded-lg border border-black/25 bg-white px-3 py-2.5 text-sm leading-6 outline-none placeholder:text-black/40 focus:border-black focus:ring-2 focus:ring-black/10"
                  />
                </label>

                <div className="grid gap-1.5 text-sm text-black/75">
                  <span>Media</span>
                  <div className="rounded-lg border border-dashed border-black/35 bg-black/[0.01] p-3">
                    {images.length > 0 ? (
                      <>
                        <p className="text-xs text-black/55">Drag images to rearrange them. The first image is used as the primary product image.</p>
                        <div role="list" aria-label="Product media" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {images.map((image, index) => (
                          <div
                            key={image.objectKey}
                            role="listitem"
                            draggable
                            aria-label={`${image.name}, position ${index + 1} of ${images.length}`}
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = "move"
                              event.dataTransfer.setData("text/plain", image.objectKey)
                              setDraggedImageKey(image.objectKey)
                              setDropImageKey(null)
                            }}
                            onDragOver={(event) => {
                              event.preventDefault()
                              event.dataTransfer.dropEffect = "move"
                              if (dropImageKey !== image.objectKey) {
                                setDropImageKey(image.objectKey)
                              }
                            }}
                            onDragLeave={(event) => {
                              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                                setDropImageKey((current) => current === image.objectKey ? null : current)
                              }
                            }}
                            onDrop={(event) => {
                              event.preventDefault()
                              const sourceKey = draggedImageKey || event.dataTransfer.getData("text/plain")
                              if (sourceKey) {
                                reorderImages(sourceKey, image.objectKey)
                              }
                              setDraggedImageKey(null)
                              setDropImageKey(null)
                            }}
                            onDragEnd={() => {
                              setDraggedImageKey(null)
                              setDropImageKey(null)
                            }}
                            className={`group relative aspect-square overflow-hidden rounded-lg border bg-white transition-[border-color,box-shadow,opacity] duration-200 ${
                              draggedImageKey === image.objectKey
                                ? "cursor-grabbing border-black/25 opacity-45"
                                : "cursor-grab border-black/10"
                            } ${
                              dropImageKey === image.objectKey && draggedImageKey !== image.objectKey
                                ? "ring-2 ring-black/50 ring-offset-2"
                                : ""
                            }`}
                          >
                            {image.url ? (
                              <Image
                                src={image.url}
                                alt={image.name}
                                fill
                                unoptimized
                                draggable={false}
                                sizes="(max-width: 640px) 50vw, 200px"
                                className="object-cover"
                              />
                            ) : (
                              <span className="flex size-full items-center justify-center text-xs text-black/45">Image unavailable</span>
                            )}
                            <div className="absolute inset-x-1.5 top-1.5 flex items-center justify-between gap-1 opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                              <span className="inline-flex h-7 items-center gap-1 rounded-md bg-white/95 px-1.5 text-[11px] font-medium text-black/65 shadow-sm">
                                <GripVertical className="size-3.5" aria-hidden="true" />
                                {index === 0 ? "Primary" : `#${index + 1}`}
                              </span>
                              <span className="flex items-center rounded-md bg-white/95 p-0.5 shadow-sm">
                                <button
                                  type="button"
                                  draggable={false}
                                  disabled={index === 0}
                                  onClick={() => moveImage(image.objectKey, -1)}
                                  aria-label={`Move ${image.name} earlier`}
                                  className="grid size-6 cursor-pointer place-items-center rounded text-black/65 transition hover:bg-black/[0.06] disabled:cursor-not-allowed disabled:opacity-35"
                                >
                                  <ArrowLeft className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  draggable={false}
                                  disabled={index === images.length - 1}
                                  onClick={() => moveImage(image.objectKey, 1)}
                                  aria-label={`Move ${image.name} later`}
                                  className="grid size-6 cursor-pointer place-items-center rounded text-black/65 transition hover:bg-black/[0.06] disabled:cursor-not-allowed disabled:opacity-35"
                                >
                                  <ArrowRight className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  draggable={false}
                                  onClick={() => removeImage(image.objectKey)}
                                  aria-label={`Remove ${image.name}`}
                                  className="grid size-6 cursor-pointer place-items-center rounded text-black/65 transition hover:bg-red-50 hover:text-red-700"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </span>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => imageInputRef.current?.click()}
                          className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-black/25 text-xs font-medium text-black/60 transition hover:border-black/50 hover:bg-black/[0.03]"
                        >
                          <ImagePlus className="mb-1 size-4" />
                          Add image
                        </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex h-28 flex-col items-center justify-center gap-2 text-center">
                        <button
                          type="button"
                          onClick={() => imageInputRef.current?.click()}
                          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-black/15 bg-white px-3 text-sm font-medium transition hover:bg-black/[0.03]"
                        >
                          <UploadCloud className="size-4" />
                          Upload images
                        </button>
                        <span className="text-xs text-black/55">AVIF, JPEG, PNG, or WebP — up to 10 MB each</span>
                      </div>
                    )}
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/avif,image/jpeg,image/png,image/webp"
                      multiple
                      onChange={handleImageSelection}
                      className="sr-only"
                    />
                  </div>
                  {isUploading ? <span className="flex items-center gap-1.5 text-xs text-black/55"><LoaderCircle className="size-3.5 animate-spin" />Uploading image{images.length === 1 ? "" : "s"}…</span> : null}
                  {uploadMessage ? <span role="status" className="text-xs text-red-700">{uploadMessage}</span> : null}
                </div>

                <label className="grid gap-1.5 text-sm text-black/75">
                  <span>Category</span>
                  <Select value={categoryId || undefined} onValueChange={(value) => { setCategoryId(value); markChanged() }}>
                    <SelectTrigger className="w-full rounded-lg border-black/25 !bg-white text-black shadow-none hover:!bg-white">
                      <SelectValue placeholder="Choose a product category" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="bg-white text-black">
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs leading-5 text-black/55">Used to group products and improve storefront filtering.</span>
                </label>
              </div>
            </Card>

            <Card title="Price" className="mt-4">
              <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm text-black/75">
                  <span>Price (MRP Inclusive)</span>
                  <span className="relative block">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-black/60">₹</span>
                    <input aria-label="Price" inputMode="decimal" value={price} onChange={(event) => { setPrice(event.target.value); markChanged() }} aria-invalid={Boolean(errorFor(fieldErrors, "price"))} className={`${inputClass} pl-7`} />
                  </span>
                  {errorFor(fieldErrors, "price") ? <span className="text-xs text-red-700">{errorFor(fieldErrors, "price")}</span> : null}
                </label>
                <label className="grid gap-1.5 text-sm text-black/75">
                  <span>Compare-at price</span>
                  <span className="relative block">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-black/60">₹</span>
                    <input aria-label="Compare-at price" inputMode="decimal" value={compareAtPrice} onChange={(event) => { setCompareAtPrice(event.target.value); markChanged() }} placeholder="0.00" aria-invalid={Boolean(errorFor(fieldErrors, "compareAtPrice"))} className={`${inputClass} pl-7`} />
                  </span>
                  {errorFor(fieldErrors, "compareAtPrice") ? <span className="text-xs text-red-700">{errorFor(fieldErrors, "compareAtPrice")}</span> : null}
                </label>
              </div>

              {/* GST & IGST Pricing Controls */}
              <div className="border-t border-black/10 bg-neutral-50/70 px-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-black/80">
                    <Receipt className="size-3.5 text-black/60" />
                    <span>GST &amp; IGST Tax Management</span>
                  </div>
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-black/70">
                    <input
                      type="checkbox"
                      checked={isTaxExempt}
                      onChange={(e) => {
                        setIsTaxExempt(e.target.checked)
                        markChanged()
                      }}
                      className="size-3.5 rounded accent-black"
                    />
                    <span>Tax Exempt (0% GST)</span>
                  </label>
                </div>

                {!isTaxExempt && (
                  <>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-xs text-black/75">
                        <span className="font-medium">GST Rate Slab</span>
                        <Select
                          value={String(taxRate)}
                          onValueChange={(val) => {
                            setTaxRate(Number(val))
                            markChanged()
                          }}
                        >
                          <SelectTrigger className="h-9 w-full rounded-lg border-black/25 !bg-white text-xs text-black shadow-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white text-xs text-black">
                            <SelectItem value="0">0% (Exempt)</SelectItem>
                            <SelectItem value="5">5% GST</SelectItem>
                            <SelectItem value="12">12% GST</SelectItem>
                            <SelectItem value="18">18% GST (Pubesto default — fans, coolers, bottles)</SelectItem>
                            <SelectItem value="28">28% GST</SelectItem>
                          </SelectContent>
                        </Select>
                      </label>

                      <label className="grid gap-1 text-xs text-black/75">
                        <span className="font-medium">HSN Code</span>
                        <input
                          type="text"
                          value={hsnCode}
                          onChange={(e) => {
                            setHsnCode(e.target.value.trim())
                            markChanged()
                          }}
                          placeholder="e.g. 8414"
                          className={`${inputClass} !h-9 font-mono text-xs`}
                        />
                      </label>
                    </div>

                    {/* Live GST & IGST Breakdown preview box */}
                    {parseFloat(price) > 0 && (
                      <div className="mt-3.5 rounded-lg border border-black/10 bg-white p-3 text-xs shadow-2xs">
                        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-black/60">
                          <span>Live Tax Breakdown (Inclusive MRP)</span>
                          <span className="font-bold text-emerald-700">{taxRate}% GST</span>
                        </div>

                        <div className="mt-2 grid grid-cols-3 gap-2 border-t border-black/5 pt-2">
                          <div>
                            <span className="block text-[10px] text-black/50">Taxable Base</span>
                            <span className="font-mono font-semibold text-black">
                              ₹{(parseFloat(price) / (1 + taxRate / 100)).toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-blue-700">Intra (CGST + SGST)</span>
                            <span className="font-mono text-blue-800">
                              2 × ₹{((parseFloat(price) - parseFloat(price) / (1 + taxRate / 100)) / 2).toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-amber-700">Inter (IGST)</span>
                            <span className="font-mono font-bold text-amber-800">
                              ₹{(parseFloat(price) - parseFloat(price) / (1 + taxRate / 100)).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>

            <Card title="Inventory" className="mt-4">
              <div className="grid items-start gap-4 px-4 pb-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm text-black/75">
                  <span>Quantity</span>
                  <input aria-label="Quantity" inputMode="numeric" min="0" type="number" value={inventoryQuantity} onChange={(event) => { setInventoryQuantity(event.target.value); markChanged() }} aria-invalid={Boolean(errorFor(fieldErrors, "inventoryQuantity"))} className={inputClass} />
                  {errorFor(fieldErrors, "inventoryQuantity") ? <span className="text-xs text-red-700">{errorFor(fieldErrors, "inventoryQuantity")}</span> : null}
                </label>
                <label className="grid gap-1.5 text-sm text-black/75">
                  <span>SKU <span className="font-normal text-black/45">(optional)</span></span>
                  <input value={sku} onChange={(event) => { setSku(event.target.value.toUpperCase()); markChanged() }} placeholder="Generated automatically" aria-invalid={Boolean(errorFor(fieldErrors, "sku"))} className={inputClass} />
                  {errorFor(fieldErrors, "sku") ? <span className="text-xs text-red-700">{errorFor(fieldErrors, "sku")}</span> : <span className="text-xs leading-5 text-black/55">Leave blank to generate a unique SKU.</span>}
                </label>
              </div>
            </Card>

            <ProductVariantsSection
              fallbackPrice={price}
              fallbackCompareAtPrice={compareAtPrice}
              fallbackInventoryQuantity={inventoryQuantity}
              initialVariants={initialProduct?.variants}
              initialSwatches={initialProduct?.pageContent?.colorSwatches}
              onChange={handleVariantsChange}
              onSwatchesChange={handleSwatchesChange}
            />
            <ProductAdditionalDetailsSection value={details} onChange={handleDetailsChange} />
            {errorFor(fieldErrors, "details") ? <p className="mt-2 text-xs text-red-700">{errorFor(fieldErrors, "details")}</p> : null}
            <ProductStorefrontSection
              media={images}
              value={pageContent}
              onChange={(next) => { setPageContent(next); markChanged() }}
            />

            <Card
              title="Search engine listing"
              className="mt-4"
              actions={
                <button type="button" aria-label="Edit search engine listing" onClick={() => setSeoExpanded((current) => !current)} className="grid size-7 cursor-pointer place-items-center rounded-md text-black/55 transition hover:bg-black/[0.05]">
                  <Pencil className="size-4" />
                </button>
              }
            >
              <div className="border-t border-black/10 px-4 py-4">
                {seoExpanded ? (
                  <div className="grid gap-4">
                    <label className="grid gap-1.5 text-sm text-black/75" htmlFor="product-seo-title">
                      <span>Page title <span className="font-normal text-black/45">({pageContent.seoTitle.length}/70)</span></span>
                      <input id="product-seo-title" maxLength={70} value={pageContent.seoTitle} onChange={(event) => { setPageContent((c) => ({ ...c, seoTitle: event.target.value })); markChanged() }} placeholder={`${title || "Product title"} | Pubesto`} className={inputClass} />
                    </label>
                    <label className="grid gap-1.5 text-sm text-black/75" htmlFor="product-seo-description">
                      <span>Meta description <span className="font-normal text-black/45">({pageContent.seoDescription.length}/320)</span></span>
                      <textarea id="product-seo-description" maxLength={320} rows={3} value={pageContent.seoDescription} onChange={(event) => { setPageContent((c) => ({ ...c, seoDescription: event.target.value })); markChanged() }} placeholder="Shown under the title in Google results. Defaults to the start of the description." className={`${inputClass} h-auto py-2`} />
                    </label>
                    <label className="grid gap-1.5 text-sm text-black/75" htmlFor="product-slug">
                      <span>URL handle</span>
                      <input id="product-slug" value={slug} onChange={(event) => { setSlug(slugify(event.target.value)); setIsCustomSlug(true); markChanged() }} placeholder="generated-from-title" className={inputClass} />
                      <span className="text-xs text-black/55">pubesto.com/product/{effectiveSlug || "product-handle"}</span>
                    </label>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-black/75">{pageContent.seoTitle || title || "Your product title"}</p>
                    <p className="mt-1 text-sm text-black/55">pubesto.com/product/{effectiveSlug || "product-handle"}</p>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-black/60">{pageContent.seoDescription || description || "Add a product title and description to preview its search listing."}</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
            <Card title="Status">
              <div className="px-4 pb-4">
                <Select value={status.toLowerCase()} onValueChange={(value) => { setStatus(value.toUpperCase() as "ACTIVE" | "DRAFT"); markChanged() }}>
                  <SelectTrigger aria-label="Product status" className="w-full rounded-lg border-black/25 bg-white shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>

            <Card title="Product organization">
              <ProductOrganizationFields
                categories={categories}
                collections={collections}
                categoryId={categoryId}
                collectionIds={collectionIds}
                tags={tags}
                onCategoryChange={(value) => { setCategoryId(value); markChanged() }}
                onCollectionIdsChange={(value) => { setCollectionIds(value); markChanged() }}
                onTagsChange={(value) => { setTags(value.map(toAdminUppercase)); markChanged() }}
              />
            </Card>
          </aside>
        </div>
      </form>
    </main>
  )
}
