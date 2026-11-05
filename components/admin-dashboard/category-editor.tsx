"use client"

import Image from "next/image"
import Link from "next/link"
import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronRight,
  CirclePlus,
  FolderTree,
  ImagePlus,
  LoaderCircle,
  Search,
  X,
} from "lucide-react"
import { toast } from "sonner"

import {
  createCategoryAction,
  updateCategoryAction,
} from "@/app/actions/categories"
import { toAdminUppercase } from "@/lib/content-case"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type {
  AdminCategoryEditor,
  AdminCategoryOption,
  AdminCategoryProduct,
} from "@/lib/server/dal/categories"

const inputClass =
  "h-10 w-full rounded-lg border border-black/25 bg-white px-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10"

type CategoryImage = {
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

  if (!body) {
    return { error: "The upload service returned an empty response." }
  }

  try {
    return JSON.parse(body) as UploadInstruction
  } catch {
    return {
      error: `The upload service returned an unexpected response (${response.status}).`,
    }
  }
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
  if (!price) {
    return "No variant price"
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(price))
}

function ProductThumbnail({ product }: { product: AdminCategoryProduct }) {
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

export function CategoryEditor({
  category,
  parentOptions,
  products,
}: {
  category?: AdminCategoryEditor
  parentOptions: AdminCategoryOption[]
  products: AdminCategoryProduct[]
}) {
  const router = useRouter()
  const imageInputRef = useRef<HTMLInputElement>(null)
  const isNew = !category
  const [name, setName] = useState(toAdminUppercase(category?.name ?? ""))
  const [description, setDescription] = useState(toAdminUppercase(category?.description ?? ""))
  const [slug, setSlug] = useState(category?.slug ?? "")
  const [isCustomSlug, setIsCustomSlug] = useState(Boolean(category?.slug))
  const [parentId, setParentId] = useState(category?.parentId ?? "")
  const [visible, setVisible] = useState(category?.visible ?? true)
  const [status, setStatus] = useState<"DRAFT" | "ACTIVE">(
    category?.status ?? "ACTIVE",
  )
  const [image, setImage] = useState<CategoryImage | null>(category?.image ?? null)
  const [imageAltText, setImageAltText] = useState(
    toAdminUppercase(category?.image?.altText ?? ""),
  )
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isSaved, setIsSaved] = useState(Boolean(category))
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [productQuery, setProductQuery] = useState("")
  const [assignedProductIds, setAssignedProductIds] = useState<string[]>(
    () => category?.products.map((product) => product.id) ?? [],
  )
  const [draftProductIds, setDraftProductIds] = useState<string[]>([])
  const [isSaving, startSaving] = useTransition()

  const assignedProductIdSet = new Set(assignedProductIds)
  const assignedProducts = products.filter((product) =>
    assignedProductIdSet.has(product.id),
  )
  const normalizedProductQuery = productQuery.trim().toLowerCase()
  const pickerProducts = products.filter((product) => {
    if (!normalizedProductQuery) {
      return true
    }

    return [product.title, product.sku, product.categoryName]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(normalizedProductQuery))
  })
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

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file) {
      return
    }

    const allowedTypes = new Set([
      "image/avif",
      "image/jpeg",
      "image/png",
      "image/webp",
    ])

    if (!allowedTypes.has(file.type) || file.size > 10 * 1024 * 1024) {
      toast.error("Choose an AVIF, JPG, PNG, or WebP image up to 10 MB.")
      return
    }

    setIsUploadingImage(true)
    try {
      const presignResponse = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
          scope: "category",
        }),
      })
      const presign = await readUploadInstruction(presignResponse)

      if (
        !presignResponse.ok ||
        !presign.objectKey ||
        !presign.uploadUrl ||
        !presign.publicUrl
      ) {
        throw new Error(presign.error || "The upload service is unavailable.")
      }

      const uploadResponse = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      })

      if (!uploadResponse.ok) {
        throw new Error("The image could not be uploaded.")
      }

      setImage({
        objectKey: presign.objectKey,
        url: presign.publicUrl,
        altText: imageAltText || null,
      })
      markChanged()
      toast.success("Category image uploaded.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The image could not be uploaded.",
      )
    } finally {
      setIsUploadingImage(false)
    }
  }

  const saveCategory = () => {
    setFieldErrors({})
    setFormMessage(null)

    startSaving(async () => {
      const input = {
        name,
        slug,
        description,
        status,
        visible,
        parentId: parentId || null,
        imageObjectKey: image?.objectKey ?? null,
        imageAltText: image ? imageAltText || null : null,
        productIds: assignedProductIds,
      }
      const result = category
        ? await updateCategoryAction(category.id, input)
        : await createCategoryAction(input)

      if (result.status === "error") {
        setFieldErrors(result.fields ?? {})
        setFormMessage(result.message)
        toast.error(result.message)
        return
      }

      setIsSaved(true)
      toast.success(isNew ? "Category created." : "Category saved.")

      if (isNew) {
        router.replace(`/dashboard/products/categories/${result.categoryId}`)
        return
      }

      router.refresh()
    })
  }

  return (
    <main className="min-h-full bg-[#f5f5f5] p-4 text-black sm:p-5">
      <div className="mx-auto max-w-[968px]">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-1.5 text-lg font-semibold">
              <FolderTree className="size-4" />
              <ChevronRight className="size-4 text-black/45" />
              {isNew ? "Add category" : "Edit category"}
            </h1>
            {!isNew && hasChanges ? (
              <p className="mt-1 text-xs text-black/55">Unsaved changes</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/products/categories"
              className="inline-flex h-9 items-center rounded-lg bg-black/[0.06] px-3 text-xs font-medium transition hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
            >
              Discard
            </Link>
            <button
              type="button"
              disabled={!name.trim() || isSaving || isUploadingImage}
              onClick={saveCategory}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-3 text-xs font-semibold text-white transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-black/15"
            >
              {isSaving ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
              {isSaving ? "Saving" : isSaved ? "Saved" : "Save"}
            </button>
          </div>
        </header>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_318px]">
          <div className="space-y-4">
            <SectionCard title="Category information">
              <div className="space-y-4 px-4 pb-4">
                <label className="grid gap-1.5 text-sm text-black/75" htmlFor="category-name">
                  <span>Title</span>
                  <input
                    id="category-name"
                    value={name}
                    onChange={(event) => {
                      const nextName = toAdminUppercase(event.target.value)
                      setName(nextName)
                      if (!isCustomSlug) {
                        setSlug(slugify(nextName))
                      }
                      markChanged()
                    }}
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={fieldErrors.name ? "category-name-error" : undefined}
                    placeholder="e.g. Denim"
                    className={`${inputClass} ${fieldErrors.name ? "border-red-500 focus:border-red-600 focus:ring-red-100" : ""}`}
                  />
                  {fieldErrors.name ? (
                    <span id="category-name-error" className="text-xs text-red-600">
                      {fieldErrors.name[0]}
                    </span>
                  ) : null}
                </label>

                <label className="grid gap-1.5 text-sm text-black/75" htmlFor="category-description">
                  <span>Description</span>
                  <textarea
                    id="category-description"
                    value={description}
                    onChange={(event) => {
                      setDescription(toAdminUppercase(event.target.value))
                      markChanged()
                    }}
                    rows={6}
                    maxLength={2_000}
                    placeholder="Describe this category for customers and search engines"
                    className="w-full resize-none rounded-lg border border-black/25 bg-white p-3 text-sm leading-6 outline-none transition focus:border-black focus:ring-2 focus:ring-black/10"
                  />
                  <span className="text-right text-xs text-black/45">
                    {description.length}/2000
                  </span>
                </label>

                <div className="grid gap-1.5 text-sm text-black/75">
                  <span>Category image</span>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/avif,image/jpeg,image/png,image/webp"
                    onChange={handleImageUpload}
                    className="sr-only"
                  />
                  {image?.url ? (
                    <div className="relative h-40 overflow-hidden rounded-lg border border-black/10 bg-black/[0.02]">
                      <Image
                        src={image.url}
                        alt={imageAltText || `${name || "Category"} category image`}
                        fill
                        sizes="(max-width: 1280px) calc(100vw - 3rem), 650px"
                        className="object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImage(null)
                          setImageAltText("")
                          markChanged()
                        }}
                        className="absolute right-2 top-2 inline-flex h-8 items-center gap-1 rounded-md bg-white/95 px-2 text-xs font-medium shadow-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                      >
                        <X className="size-3.5" /> Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isUploadingImage}
                      onClick={() => imageInputRef.current?.click()}
                      className="flex h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-black/35 text-sm text-black/65 transition hover:border-black/60 hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:cursor-not-allowed"
                    >
                      {isUploadingImage ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : (
                        <ImagePlus className="size-4" />
                      )}
                      <span>{isUploadingImage ? "Uploading image" : "Upload image"}</span>
                    </button>
                  )}
                  {image ? (
                    <label className="grid gap-1.5" htmlFor="category-image-alt">
                      <span className="text-xs">Alt text</span>
                      <input
                        id="category-image-alt"
                        value={imageAltText}
                        onChange={(event) => {
                          setImageAltText(toAdminUppercase(event.target.value))
                          markChanged()
                        }}
                        maxLength={300}
                        placeholder={`${name || "Category"} collection image`}
                        className={inputClass}
                      />
                    </label>
                  ) : null}
                  <span className="text-xs text-black/55">
                    Shown in category cards and storefront navigation. AVIF, JPG, PNG, or WebP up to 10 MB.
                  </span>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Products"
              action={
                <button
                  type="button"
                  onClick={openPicker}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-black px-3 text-xs font-medium text-white transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                >
                  <CirclePlus className="size-3.5" />
                  Add products
                </button>
              }
            >
              <div className="border-t border-black/10">
                <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs text-black/60">
                  <span>{assignedProducts.length} products currently assigned</span>
                  <span>One category per product</span>
                </div>
                {assignedProducts.length ? (
                  <div className="divide-y divide-black/10">
                    {assignedProducts.map((product) => (
                      <div key={product.id} className="flex items-center gap-3 px-4 py-3">
                        <ProductThumbnail product={product} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{product.title}</p>
                          <p className="mt-0.5 text-xs text-black/55">
                            {[product.sku, priceLabel(product.price)].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAssignedProductIds((current) =>
                              current.filter((id) => id !== product.id),
                            )
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
                    <p className="mt-1 text-xs text-black/55">
                      Add products to make this category available to customers.
                    </p>
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Search engine listing">
              <div className="space-y-3 px-4 pb-4">
                <label className="grid gap-1.5 text-sm text-black/75" htmlFor="category-slug">
                  <span>URL handle</span>
                  <span className="flex h-10 items-center overflow-hidden rounded-lg border border-black/25 bg-white transition focus-within:border-black focus-within:ring-2 focus-within:ring-black/10">
                    <span className="border-r border-black/10 px-3 text-sm text-black/45">/categories/</span>
                    <input
                      id="category-slug"
                      value={slug}
                      onChange={(event) => {
                        setSlug(slugify(event.target.value))
                        setIsCustomSlug(true)
                        markChanged()
                      }}
                      placeholder="denim"
                      className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
                    />
                  </span>
                </label>
                <p className="text-xs text-black/55">
                  A clear handle makes the category easier to find and share. Duplicate handles receive a unique suffix automatically.
                </p>
              </div>
            </SectionCard>
          </div>

          <aside className="space-y-4">
            <SectionCard title="Status">
              <div className="px-4 pb-4">
                <Select
                  value={status}
                  onValueChange={(value: "DRAFT" | "ACTIVE") => {
                    setStatus(value)
                    markChanged()
                  }}
                >
                  <SelectTrigger className="w-full rounded-lg border-black/25 !bg-white text-black shadow-none focus:ring-2 focus:ring-black/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="bg-white text-black">
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </SectionCard>

            <SectionCard title="Category organization">
              <div className="space-y-4 px-4 pb-4">
                <div className="grid gap-1.5 text-sm text-black/75">
                  <span>Parent category</span>
                  <Select
                    value={parentId || "root"}
                    onValueChange={(value) => {
                      setParentId(value === "root" ? "" : value)
                      markChanged()
                    }}
                  >
                    <SelectTrigger className="w-full rounded-lg border-black/25 !bg-white text-black shadow-none focus:ring-2 focus:ring-black/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" className="bg-white text-black">
                      <SelectItem value="root">No parent category</SelectItem>
                      {parentOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center justify-between gap-3 rounded-lg border border-black/10 px-3 py-2.5 text-sm">
                  <span>
                    <span className="block font-medium">Store visibility</span>
                    <span className="mt-0.5 block text-xs text-black/55">
                      Customers can browse this category.
                    </span>
                  </span>
                  <Switch
                    checked={visible}
                    onCheckedChange={(checked) => {
                      setVisible(checked)
                      markChanged()
                    }}
                    aria-label="Toggle store visibility"
                  />
                </label>
              </div>
            </SectionCard>

            <SectionCard title="Category summary">
              <div className="space-y-3 px-4 pb-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-black/60">Products added</span>
                  <span className="font-semibold">{assignedProducts.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-black/60">Storefront</span>
                  <span className="font-medium">{visible ? "Visible" : "Hidden"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-black/60">Status</span>
                  <span className="font-medium capitalize">{status.toLowerCase()}</span>
                </div>
              </div>
            </SectionCard>
          </aside>
        </div>

        {formMessage ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {formMessage}
          </p>
        ) : null}
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent
          showCloseButton={false}
          className="gap-0 overflow-hidden p-0 sm:!w-[620px] sm:!max-w-[620px]"
          overlayClassName="bg-black/45 supports-backdrop-filter:backdrop-blur-[1px]"
        >
          <DialogHeader className="border-b border-black/10 px-5 py-4">
            <DialogTitle className="text-base font-semibold">Add products</DialogTitle>
            <DialogDescription>
              Select the products that belong to this category. Products can belong to one category at a time.
            </DialogDescription>
          </DialogHeader>
          <div className="border-b border-black/10 p-4">
            <label className="flex h-10 items-center gap-2 rounded-lg border border-black/20 bg-white px-3 text-sm text-black/55 transition focus-within:border-black focus-within:ring-2 focus-within:ring-black/10">
              <Search className="size-4" />
              <input
                autoFocus
                value={productQuery}
                onChange={(event) => setProductQuery(event.target.value)}
                placeholder="Search products"
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-black/40"
              />
            </label>
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {pickerProducts.length ? (
              pickerProducts.map((product) => (
                <label
                  key={product.id}
                  className="flex cursor-pointer items-center gap-3 border-b border-black/[0.08] px-4 py-2.5 transition hover:bg-black/[0.025]"
                >
                  <input
                    type="checkbox"
                    checked={draftProductIds.includes(product.id)}
                    onChange={() => toggleDraftProduct(product.id)}
                    className="size-4 rounded accent-black"
                  />
                  <ProductThumbnail product={product} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{product.title}</span>
                    <span className="mt-0.5 block text-xs text-black/55">
                      {[product.sku, priceLabel(product.price), product.categoryName].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </label>
              ))
            ) : (
              <p className="px-4 py-10 text-center text-sm text-black/55">No products match your search.</p>
            )}
          </div>
          <DialogFooter className="flex-row items-center justify-between border-t border-black/10 px-4 py-3 sm:justify-between">
            <span className="text-xs text-black/55">{draftProductIds.length} selected</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="h-9 rounded-lg border border-black/15 px-3 text-sm font-medium transition hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setAssignedProductIds(draftProductIds)
                  setPickerOpen(false)
                  markChanged()
                }}
                className="h-9 rounded-lg bg-black px-3 text-sm font-medium text-white transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
              >
                Add products
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
