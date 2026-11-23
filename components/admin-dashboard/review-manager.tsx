"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, LoaderCircle, Pencil, Plus, Search, Star, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import {
  createReviewAction,
  deleteReviewsAction,
  setReviewFlagsAction,
  setReviewSortOrderAction,
  updateReviewAction,
} from "@/app/actions/reviews"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { AdminReviewListItem, AdminReviewProductOption } from "@/lib/server/dal/reviews"

type ReviewFilter = "ALL" | "PENDING" | "PUBLISHED" | "HOMEPAGE"

type ReviewForm = {
  customerName: string
  customerImage: string
  rating: number
  text: string
  productSlug: string
  productName: string
  showOnHomepage: boolean
  isPublished: boolean
  sortOrder: number
  /** yyyy-mm-dd; the date the customer wrote the review (email, Google, etc.). */
  reviewDate: string
}

const NO_PRODUCT = "__none__"

const emptyForm: ReviewForm = {
  customerName: "",
  customerImage: "",
  rating: 5,
  text: "",
  productSlug: "",
  productName: "",
  showOnHomepage: false,
  isPublished: true,
  sortOrder: 100,
  reviewDate: "",
}

function todayISO() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

const inputClass =
  "h-10 rounded-lg border border-black/25 bg-white px-3 text-sm font-normal outline-none transition focus:border-black focus:ring-2 focus:ring-black/10"

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "C"
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function filterLabel(filter: ReviewFilter) {
  if (filter === "PENDING") return "Pending approval"
  if (filter === "PUBLISHED") return "Published"
  if (filter === "HOMEPAGE") return "On homepage"
  return "All reviews"
}

function Stars({ rating, size = "size-3.5" }: { rating: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star key={value} className={size} fill={value <= rating ? "currentColor" : "none"} />
      ))}
    </span>
  )
}

function ReviewAvatar({ name, image }: { name: string; image: string }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" className="size-9 shrink-0 rounded-full object-cover" />
  }
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#0c3152] text-[11px] font-semibold text-white">
      {initials(name)}
    </span>
  )
}

function SortOrderInput({ review, disabled }: { review: AdminReviewListItem; disabled: boolean }) {
  const router = useRouter()
  const [value, setValue] = useState(String(review.sortOrder))
  const [isPending, startTransition] = useTransition()

  const save = () => {
    const next = Number(value)
    if (!Number.isInteger(next) || next < 0) {
      setValue(String(review.sortOrder))
      toast.error("Sort order must be a whole number of 0 or more.")
      return
    }
    if (next === review.sortOrder) return
    startTransition(async () => {
      const result = await setReviewSortOrderAction({ id: review.id, sortOrder: next })
      if (!result.success) {
        setValue(String(review.sortOrder))
        toast.error(result.message)
        return
      }
      toast.success("Sort order saved.")
      router.refresh()
    })
  }

  return (
    <input
      type="number"
      min={0}
      value={value}
      disabled={disabled || isPending}
      onChange={(event) => setValue(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur()
      }}
      aria-label={`Sort order for ${review.customerName}`}
      className="h-7 w-16 rounded-md border border-black/15 bg-white px-2 text-right text-xs outline-none focus:border-black disabled:opacity-50"
    />
  )
}

export function ReviewManager({
  reviews,
  products,
  canManage,
  canDelete,
}: {
  reviews: AdminReviewListItem[]
  products: AdminReviewProductOption[]
  canManage: boolean
  canDelete: boolean
}) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<ReviewFilter>("ALL")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [reviewsToDelete, setReviewsToDelete] = useState<string[] | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ReviewForm>(emptyForm)
  const [isPending, startTransition] = useTransition()

  const pendingCount = reviews.filter((review) => !review.isPublished).length
  const publishedCount = reviews.length - pendingCount
  const homepageCount = reviews.filter((review) => review.showOnHomepage && review.isPublished).length
  const publishedReviews = reviews.filter((review) => review.isPublished)
  const averageRating = publishedReviews.length
    ? publishedReviews.reduce((sum, review) => sum + review.rating, 0) / publishedReviews.length
    : 0

  const normalizedQuery = query.trim().toLowerCase()
  const visibleReviews = useMemo(
    () =>
      reviews.filter((review) => {
        const matchesQuery =
          !normalizedQuery ||
          [review.customerName, review.text, review.productName, review.productSlug, review.customerEmail ?? ""].some((value) =>
            value.toLowerCase().includes(normalizedQuery),
          )
        const matchesFilter =
          filter === "ALL" ||
          (filter === "PENDING" && !review.isPublished) ||
          (filter === "PUBLISHED" && review.isPublished) ||
          (filter === "HOMEPAGE" && review.showOnHomepage)
        return matchesQuery && matchesFilter
      }),
    [filter, normalizedQuery, reviews],
  )
  const allSelected = visibleReviews.length > 0 && visibleReviews.every((review) => selectedIds.includes(review.id))

  const productOptions = useMemo(() => {
    const options = [...products]
    if (form.productSlug && !options.some((option) => option.slug === form.productSlug)) {
      options.unshift({ slug: form.productSlug, title: form.productName || form.productSlug })
    }
    return options
  }, [form.productName, form.productSlug, products])

  const toggleAll = () => {
    const ids = visibleReviews.map((review) => review.id)
    setSelectedIds((current) => (allSelected ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])]))
  }
  const toggleReview = (id: string) =>
    setSelectedIds((current) => (current.includes(id) ? current.filter((currentId) => currentId !== id) : [...current, id]))

  const setFlags = (ids: string[], flags: { isPublished?: boolean; showOnHomepage?: boolean }, successMessage: string) => {
    if (!ids.length) return
    startTransition(async () => {
      const result = await setReviewFlagsAction({ ids, ...flags })
      if (!result.success) {
        toast.error(result.message)
        return
      }
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)))
      toast.success(successMessage)
      router.refresh()
    })
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...emptyForm, reviewDate: todayISO() })
    setEditorOpen(true)
  }

  const openEdit = (review: AdminReviewListItem) => {
    setEditingId(review.id)
    setForm({
      customerName: review.customerName,
      customerImage: review.customerImage,
      rating: review.rating,
      text: review.text,
      productSlug: review.productSlug,
      productName: review.productName,
      showOnHomepage: review.showOnHomepage,
      isPublished: review.isPublished,
      sortOrder: review.sortOrder,
      reviewDate: review.createdAt.slice(0, 10),
    })
    setEditorOpen(true)
  }

  const setField = <K extends keyof ReviewForm>(key: K, value: ReviewForm[K]) => setForm((current) => ({ ...current, [key]: value }))

  const saveReview = () => {
    startTransition(async () => {
      const result = editingId ? await updateReviewAction({ id: editingId, ...form }) : await createReviewAction(form)
      if (!result.success) {
        toast.error(result.message)
        return
      }
      setEditorOpen(false)
      toast.success(editingId ? "Review updated." : "Review created.")
      router.refresh()
    })
  }

  const deleteReviews = () => {
    if (!reviewsToDelete?.length) return
    const ids = reviewsToDelete
    startTransition(async () => {
      const result = await deleteReviewsAction(ids)
      if (!result.success) {
        toast.error(result.message)
        return
      }
      setReviewsToDelete(null)
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)))
      toast.success(result.count === 1 ? "Review deleted." : `${result.count} reviews deleted.`)
      router.refresh()
    })
  }

  return (
    <main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-5">
      <div className="w-full">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <Star className="size-4" />
              Reviews
            </h1>
            <p className="mt-1 text-xs text-black/55">
              Approve customer reviews, feature them on the homepage, and keep their text tidy.
            </p>
          </div>
          {canManage ? (
            <button
              type="button"
              disabled={isPending}
              onClick={openCreate}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-3 text-xs font-medium text-white transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-black/50"
            >
              <Plus className="size-3.5" /> Add review
            </button>
          ) : null}
        </header>

        <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Awaiting approval", value: String(pendingCount), action: pendingCount ? () => setFilter("PENDING") : undefined },
            { label: "Published", value: String(publishedCount) },
            { label: "On homepage", value: String(homepageCount) },
            { label: "Average rating", value: publishedReviews.length ? averageRating.toFixed(1) : "–" },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-xl border bg-white px-4 py-3 shadow-sm ${stat.label === "Awaiting approval" && pendingCount ? "border-amber-300" : "border-black/10"}`}>
              <p className="text-xs text-black/55">{stat.label}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-xl font-semibold">{stat.value}</p>
                {stat.action ? (
                  <button type="button" onClick={stat.action} className="text-xs font-medium text-[#0c3152] hover:underline">
                    Review now
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </section>

        <section className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-black/10 px-4 py-3">
            <label className="flex min-w-52 flex-1 items-center gap-2 text-sm text-black/50">
              <Search className="size-4" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search reviews"
                placeholder="Search by customer, product or text"
                className="w-full bg-transparent outline-none placeholder:text-black/45"
              />
            </label>
            <Select value={filter} onValueChange={(value) => setFilter(value as ReviewFilter)}>
              <SelectTrigger aria-label="Filter reviews" className="h-8 w-44 rounded-md border-black/15 bg-white px-2 text-xs font-medium shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {(["ALL", "PENDING", "PUBLISHED", "HOMEPAGE"] as ReviewFilter[]).map((value) => (
                  <SelectItem key={value} value={value}>
                    {filterLabel(value)}
                    {value === "PENDING" && pendingCount ? ` (${pendingCount})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-black/45">
              {visibleReviews.length} {visibleReviews.length === 1 ? "review" : "reviews"}
            </span>
          </div>

          {selectedIds.length ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-black/10 bg-black/[0.02] px-3 py-2">
              <button type="button" onClick={() => setSelectedIds([])} aria-label="Clear review selection" className="grid size-7 place-items-center rounded-md text-black/55 transition hover:bg-black/[0.06]">
                <X className="size-4" />
              </button>
              <span className="text-xs font-semibold">{selectedIds.length} selected</span>
              {canManage ? (
                <>
                  <button type="button" disabled={isPending} onClick={() => setFlags(selectedIds, { isPublished: true }, "Reviews published.")} className="h-7 rounded-md border border-black/15 bg-white px-2.5 text-xs font-medium transition hover:bg-black/[0.04] disabled:opacity-50">
                    Publish
                  </button>
                  <button type="button" disabled={isPending} onClick={() => setFlags(selectedIds, { isPublished: false }, "Reviews unpublished.")} className="h-7 rounded-md border border-black/15 bg-white px-2.5 text-xs font-medium transition hover:bg-black/[0.04] disabled:opacity-50">
                    Unpublish
                  </button>
                  <button type="button" disabled={isPending} onClick={() => setFlags(selectedIds, { showOnHomepage: true }, "Reviews added to the homepage.")} className="h-7 rounded-md border border-black/15 bg-white px-2.5 text-xs font-medium transition hover:bg-black/[0.04] disabled:opacity-50">
                    Show on homepage
                  </button>
                  <button type="button" disabled={isPending} onClick={() => setFlags(selectedIds, { showOnHomepage: false }, "Reviews removed from the homepage.")} className="h-7 rounded-md border border-black/15 bg-white px-2.5 text-xs font-medium transition hover:bg-black/[0.04] disabled:opacity-50">
                    Hide from homepage
                  </button>
                </>
              ) : null}
              {canDelete ? (
                <button type="button" disabled={isPending} onClick={() => setReviewsToDelete(selectedIds)} className="inline-flex h-7 items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50">
                  <Trash2 className="size-3" />
                  Delete
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-left text-xs">
              <thead className="bg-black/[0.025] text-black/65">
                <tr>
                  <th className="w-12 border-b border-black/10 px-3 py-2.5">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all visible reviews" className="size-4 accent-black" />
                  </th>
                  <th className="border-b border-black/10 px-3 py-2.5 font-medium">Customer</th>
                  <th className="border-b border-black/10 px-3 py-2.5 font-medium">Review</th>
                  <th className="border-b border-black/10 px-3 py-2.5 font-medium">Product</th>
                  <th className="border-b border-black/10 px-3 py-2.5 font-medium">Status</th>
                  <th className="border-b border-black/10 px-3 py-2.5 font-medium">Published</th>
                  <th className="border-b border-black/10 px-3 py-2.5 font-medium">Homepage</th>
                  <th className="border-b border-black/10 px-3 py-2.5 text-right font-medium">Sort</th>
                  <th className="w-24 border-b border-black/10 px-3 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {visibleReviews.map((review) => {
                  const selected = selectedIds.includes(review.id)
                  return (
                    <tr
                      key={review.id}
                      className={selected ? "bg-black/[0.025]" : !review.isPublished ? "bg-amber-50/70 transition hover:bg-amber-50" : "transition hover:bg-black/[0.02]"}
                    >
                      <td className="border-b border-black/10 px-3 py-3 align-top">
                        <input type="checkbox" checked={selected} onChange={() => toggleReview(review.id)} aria-label={`Select review by ${review.customerName}`} className="size-4 accent-black" />
                      </td>
                      <td className="border-b border-black/10 px-3 py-3 align-top">
                        <div className="flex items-center gap-3">
                          <ReviewAvatar name={review.customerName} image={review.customerImage} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-[#0c3152]">{review.customerName}</span>
                            <span className="mt-1 block truncate text-[11px] text-black/50">{review.customerEmail ?? formatDate(review.createdAt)}</span>
                          </span>
                        </div>
                      </td>
                      <td className="max-w-md border-b border-black/10 px-3 py-3 align-top">
                        <Stars rating={review.rating} />
                        <p className="mt-1 line-clamp-3 text-black/75">{review.text}</p>
                        <p className="mt-1 text-[11px] text-black/45">{formatDate(review.createdAt)}</p>
                      </td>
                      <td className="border-b border-black/10 px-3 py-3 align-top text-black/65">
                        {review.productName || review.productSlug || <span className="text-black/40">Homepage only</span>}
                      </td>
                      <td className="border-b border-black/10 px-3 py-3 align-top">
                        <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold ${review.isPublished ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
                          {review.isPublished ? "Published" : "Pending approval"}
                        </span>
                      </td>
                      <td className="border-b border-black/10 px-3 py-3 align-top">
                        <Switch
                          size="sm"
                          checked={review.isPublished}
                          disabled={!canManage || isPending}
                          onCheckedChange={(checked) => setFlags([review.id], { isPublished: checked }, checked ? "Review published." : "Review unpublished.")}
                          aria-label={`Published: ${review.customerName}`}
                        />
                      </td>
                      <td className="border-b border-black/10 px-3 py-3 align-top">
                        <Switch
                          size="sm"
                          checked={review.showOnHomepage}
                          disabled={!canManage || isPending}
                          onCheckedChange={(checked) => setFlags([review.id], { showOnHomepage: checked }, checked ? "Review added to the homepage." : "Review removed from the homepage.")}
                          aria-label={`Show on homepage: ${review.customerName}`}
                        />
                      </td>
                      <td className="border-b border-black/10 px-3 py-3 text-right align-top">
                        <SortOrderInput key={`${review.id}-${review.sortOrder}`} review={review} disabled={!canManage} />
                      </td>
                      <td className="border-b border-black/10 px-3 py-3 align-top">
                        <div className="flex items-center justify-end gap-1">
                          {!review.isPublished && canManage ? (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => setFlags([review.id], { isPublished: true }, "Review approved and published.")}
                              className="inline-flex h-7 items-center gap-1 rounded-md bg-black px-2 text-[11px] font-medium text-white transition hover:bg-black/80 disabled:opacity-50"
                            >
                              <Check className="size-3" />
                              Approve
                            </button>
                          ) : null}
                          {canManage ? (
                            <button type="button" disabled={isPending} onClick={() => openEdit(review)} aria-label={`Edit review by ${review.customerName}`} className="grid size-7 place-items-center rounded-md text-black/50 transition hover:bg-black/[0.06] hover:text-black disabled:opacity-60">
                              <Pencil className="size-3.5" />
                            </button>
                          ) : null}
                          {canDelete ? (
                            <button type="button" disabled={isPending} onClick={() => setReviewsToDelete([review.id])} aria-label={`Delete review by ${review.customerName}`} className="grid size-7 place-items-center rounded-md text-black/50 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60">
                              <Trash2 className="size-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {!visibleReviews.length ? (
            <div className="px-6 py-16 text-center">
              <Star className="mx-auto size-7 text-black/35" />
              <p className="mt-3 text-sm font-semibold">{reviews.length ? "No reviews match your filters." : "No reviews yet."}</p>
              <p className="mt-1 text-xs text-black/55">Reviews submitted on product pages wait here for approval.</p>
            </div>
          ) : null}
        </section>
      </div>

      <Dialog open={editorOpen} onOpenChange={(open) => { if (!isPending) setEditorOpen(open) }}>
        <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:!w-[560px] sm:!max-w-[560px]" overlayClassName="bg-black/45 supports-backdrop-filter:backdrop-blur-[1px]">
          <DialogHeader className="border-b border-black/10 px-5 py-4">
            <DialogTitle>{editingId ? "Edit review" : "Add review"}</DialogTitle>
            <DialogDescription>
              Add reviews customers sent you by email, Google, WhatsApp or Instagram. Pick the product the review is about, and set the date the customer wrote it.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); saveReview() }}>
            <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium">
                  Customer name
                  <input autoFocus value={form.customerName} onChange={(event) => setField("customerName", event.target.value)} className={inputClass} />
                </label>
                <div className="grid gap-1.5 text-sm font-medium">
                  Rating
                  <div className="flex h-10 items-center gap-1">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button key={value} type="button" onClick={() => setField("rating", value)} aria-label={`${value} star${value === 1 ? "" : "s"}`} className="rounded p-0.5 text-amber-500 transition hover:scale-110">
                        <Star className="size-5" fill={value <= form.rating ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <label className="grid gap-1.5 text-sm font-medium">
                Review
                <textarea value={form.text} onChange={(event) => setField("text", event.target.value)} rows={5} className="rounded-lg border border-black/25 bg-white px-3 py-2 text-sm font-normal outline-none transition focus:border-black focus:ring-2 focus:ring-black/10" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5 text-sm font-medium">
                  Product
                  <Select
                    value={form.productSlug || NO_PRODUCT}
                    onValueChange={(value) => {
                      if (value === NO_PRODUCT) {
                        setForm((current) => ({ ...current, productSlug: "", productName: "" }))
                        return
                      }
                      const product = productOptions.find((option) => option.slug === value)
                      setForm((current) => ({ ...current, productSlug: value, productName: product?.title ?? current.productName }))
                    }}
                  >
                    <SelectTrigger aria-label="Product" className="h-10 w-full rounded-lg border-black/25 bg-white px-3 text-sm font-normal shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-h-72">
                      <SelectItem value={NO_PRODUCT}>No product (homepage only)</SelectItem>
                      {productOptions.map((product) => (
                        <SelectItem key={product.slug} value={product.slug}>
                          {product.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="grid gap-1.5 text-sm font-medium">
                  Review date
                  <input type="date" max={todayISO()} value={form.reviewDate} onChange={(event) => setField("reviewDate", event.target.value)} className={inputClass} />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium">
                  Sort order
                  <input type="number" min={0} value={form.sortOrder} onChange={(event) => setField("sortOrder", Number(event.target.value))} className={inputClass} />
                </label>
              </div>
              <label className="grid gap-1.5 text-sm font-medium">
                Customer image URL
                <div className="flex items-center gap-3">
                  <input value={form.customerImage} onChange={(event) => setField("customerImage", event.target.value)} placeholder="https://…" className={`${inputClass} flex-1`} />
                  <ReviewAvatar name={form.customerName || "Customer"} image={form.customerImage} />
                </div>
              </label>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm text-black/70">
                  <Switch checked={form.isPublished} onCheckedChange={(checked) => setField("isPublished", checked)} />
                  Published
                </label>
                <label className="flex items-center gap-2 text-sm text-black/70">
                  <Switch checked={form.showOnHomepage} onCheckedChange={(checked) => setField("showOnHomepage", checked)} />
                  Show on homepage
                </label>
              </div>
            </div>
            <DialogFooter className="flex-row justify-end border-t border-black/10 px-5 py-3">
              <button type="button" disabled={isPending} onClick={() => setEditorOpen(false)} className="h-9 rounded-lg border border-black/15 px-3 text-sm font-medium transition hover:bg-black/[0.03] disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={isPending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-3 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/30">
                {isPending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
                {editingId ? "Save review" : "Create review"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(reviewsToDelete?.length)} onOpenChange={(open) => { if (!open) setReviewsToDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {reviewsToDelete?.length === 1 ? "review" : `${reviewsToDelete?.length ?? 0} reviews`}?</AlertDialogTitle>
            <AlertDialogDescription>
              The review will be removed from the storefront and the dashboard. This cannot be undone. To hide it instead, unpublish it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={deleteReviews} className="bg-red-600 text-white hover:bg-red-700">
              {isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
