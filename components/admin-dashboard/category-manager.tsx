"use client"

import Image from "next/image"
import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { FolderTree, LoaderCircle, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  deleteCategoriesAction,
  updateCategoryVisibilityAction,
} from "@/app/actions/categories"
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
import { Switch } from "@/components/ui/switch"
import type { AdminCategoryListItem } from "@/lib/server/dal/categories"

function StatusBadge({ status }: { status: AdminCategoryListItem["status"] }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
        status === "ACTIVE"
          ? "bg-emerald-100 text-emerald-900"
          : "bg-black/[0.06] text-black/60"
      }`}
    >
      {status === "ACTIVE" ? "Active" : "Draft"}
    </span>
  )
}

export function CategoryManager({
  initialCategories,
}: {
  initialCategories: AdminCategoryListItem[]
}) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [visibilityOverrides, setVisibilityOverrides] = useState<Record<string, boolean>>({})
  const [categoriesToDelete, setCategoriesToDelete] = useState<string[] | null>(null)
  const [isPending, startTransition] = useTransition()
  const normalizedQuery = query.trim().toLowerCase()
  const categories = initialCategories.map((category) => ({
    ...category,
    visible: visibilityOverrides[category.id] ?? category.visible,
  }))
  const visibleCategories = categories.filter((category) =>
    [category.name, category.slug, category.parent?.name]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(normalizedQuery)),
  )
  const visibleCategoryIdSet = new Set(visibleCategories.map((category) => category.id))
  const selectedVisibleCount = selectedCategoryIds.filter((id) =>
    visibleCategoryIdSet.has(id),
  ).length
  const allVisibleSelected =
    visibleCategories.length > 0 && selectedVisibleCount === visibleCategories.length

  const toggleCategorySelection = (categoryId: string) => {
    setSelectedCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    )
  }

  const toggleVisibleCategories = () => {
    setSelectedCategoryIds((current) => {
      const selected = new Set(current)
      if (allVisibleSelected) {
        visibleCategories.forEach((category) => selected.delete(category.id))
      } else {
        visibleCategories.forEach((category) => selected.add(category.id))
      }
      return [...selected]
    })
  }

  const toggleVisibility = (categoryId: string, visible: boolean) => {
    const previousVisible = categories.find((category) => category.id === categoryId)?.visible
    setVisibilityOverrides((current) => ({ ...current, [categoryId]: visible }))

    startTransition(async () => {
      const result = await updateCategoryVisibilityAction(categoryId, visible)
      if (!result.success) {
        setVisibilityOverrides((current) => ({
          ...current,
          [categoryId]: previousVisible ?? !visible,
        }))
        toast.error(result.message)
        return
      }

      toast.success(visible ? "Category is now visible." : "Category is now hidden.")
      router.refresh()
    })
  }

  const confirmDelete = () => {
    if (!categoriesToDelete?.length) {
      return
    }

    const ids = categoriesToDelete
    setCategoriesToDelete(null)
    startTransition(async () => {
      const result = await deleteCategoriesAction(ids)
      if (!result.success) {
        toast.error(result.message)
        return
      }

      setSelectedCategoryIds((current) => current.filter((id) => !ids.includes(id)))
      toast.success(
        result.count === 1 ? "Category deleted." : `${result.count} categories deleted.`,
      )
      router.refresh()
    })
  }

  return (
    <main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-5">
      <div className="w-full">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <FolderTree className="size-4" />
              Categories
            </h1>
            <p className="mt-1 text-xs text-black/55">
              Organize the storefront and assign products to their category.
            </p>
          </div>
          <Link
            href="/dashboard/products/categories/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-3 text-xs font-medium text-white transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          >
            <Plus className="size-3.5" />
            Add category
          </Link>
        </div>

        <section className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-black/10 px-4 py-3">
            <label className="flex h-9 min-w-52 flex-1 items-center gap-2 rounded-lg border border-black/15 bg-white px-3 text-sm text-black/50 transition focus-within:border-black focus-within:ring-2 focus-within:ring-black/10">
              <Search className="size-4" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search and filter categories"
                placeholder="Search categories"
                className="w-full bg-transparent outline-none placeholder:text-black/45"
              />
            </label>
            {selectedCategoryIds.length ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => setCategoriesToDelete(selectedCategoryIds)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="size-3.5" />
                Delete {selectedCategoryIds.length}
              </button>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-xs">
              <thead className="bg-black/[0.025] text-black/65">
                <tr>
                  <th className="w-12 border-b border-black/10 px-3 py-2.5 font-medium">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleVisibleCategories}
                      aria-label="Select all visible categories"
                      className="size-4 rounded accent-black"
                    />
                  </th>
                  <th className="border-b border-black/10 px-3 py-2.5 font-medium">Category</th>
                  <th className="border-b border-black/10 px-3 py-2.5 font-medium">Parent</th>
                  <th className="w-24 border-b border-black/10 px-3 py-2.5 font-medium">Products</th>
                  <th className="w-24 border-b border-black/10 px-3 py-2.5 font-medium">Status</th>
                  <th className="w-40 border-b border-black/10 px-3 py-2.5 font-medium">Store visibility</th>
                  <th className="w-24 border-b border-black/10 px-3 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {visibleCategories.map((category) => (
                  <tr key={category.id} className="transition hover:bg-black/[0.02]">
                    <td className="border-b border-black/10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedCategoryIds.includes(category.id)}
                        onChange={() => toggleCategorySelection(category.id)}
                        aria-label={`Select ${category.name}`}
                        className="size-4 rounded accent-black"
                      />
                    </td>
                    <td className="border-b border-black/10 px-3 py-2.5">
                      <Link
                        href={`/dashboard/products/categories/${category.id}`}
                        className="flex items-center gap-3 font-medium text-[#0c3152] outline-none transition hover:underline focus-visible:ring-2 focus-visible:ring-black"
                      >
                        {category.image?.url ? (
                          <Image
                            src={category.image.url}
                            alt={category.image.altText || category.name}
                            width={40}
                            height={40}
                            sizes="40px"
                            className="size-10 rounded-lg border border-black/10 object-cover"
                          />
                        ) : (
                          <span className="flex size-10 items-center justify-center rounded-lg border border-black/10 bg-black/[0.04] text-xs font-semibold text-black/60">
                            {category.name.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <span>
                          <span className="block">{category.name}</span>
                          <span className="mt-1 block text-[11px] font-normal text-black/45">
                            /categories/{category.slug}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="border-b border-black/10 px-3 py-2.5 text-black/65">
                      {category.parent?.name ?? "—"}
                    </td>
                    <td className="border-b border-black/10 px-3 py-2.5 text-black/65">
                      {category.productCount}
                    </td>
                    <td className="border-b border-black/10 px-3 py-2.5">
                      <StatusBadge status={category.status} />
                    </td>
                    <td className="border-b border-black/10 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={category.visible}
                          disabled={isPending}
                          onCheckedChange={(checked) =>
                            toggleVisibility(category.id, checked)
                          }
                          aria-label={`Toggle ${category.name} visibility`}
                        />
                        <span className="text-black/60">
                          {category.visible ? "Visible" : "Hidden"}
                        </span>
                      </div>
                    </td>
                    <td className="border-b border-black/10 px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/dashboard/products/categories/${category.id}`}
                          aria-label={`Edit ${category.name}`}
                          className="rounded-md p-1.5 text-black/50 transition hover:bg-black/[0.06] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                        >
                          <Pencil className="size-3.5" />
                        </Link>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setCategoriesToDelete([category.id])}
                          aria-label={`Delete ${category.name}`}
                          className="rounded-md p-1.5 text-black/50 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibleCategories.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm font-medium">No categories match your search.</p>
              <p className="mt-1 text-xs text-black/55">Try a different term or create a new category.</p>
            </div>
          ) : null}
        </section>
      </div>

      <AlertDialog
        open={Boolean(categoriesToDelete?.length)}
        onOpenChange={(open) => {
          if (!open) {
            setCategoriesToDelete(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {categoriesToDelete?.length === 1 ? "category" : "categories"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Products in these categories will become uncategorized. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={confirmDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isPending ? <LoaderCircle className="animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
