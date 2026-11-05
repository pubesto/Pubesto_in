"use client"

import Image from "next/image"
import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Link2, LoaderCircle, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  deleteCollectionsAction,
} from "@/app/actions/collections"
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
import type { AdminCollectionListItem } from "@/lib/server/dal/collections"

function StatusBadge({ isPublished }: { isPublished: boolean }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${isPublished ? "bg-emerald-100 text-emerald-900" : "bg-black/[0.06] text-black/60"}`}>
      {isPublished ? "Published" : "Draft"}
    </span>
  )
}

export function CollectionManager({
  initialCollections,
}: {
  initialCollections: AdminCollectionListItem[]
}) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([])
  const [collectionsToDelete, setCollectionsToDelete] = useState<string[] | null>(null)
  const [isPending, startTransition] = useTransition()
  const normalizedQuery = query.trim().toLowerCase()
  const collections = initialCollections
  const visibleCollections = collections.filter((collection) =>
    [collection.title, collection.slug, collection.description]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(normalizedQuery)),
  )
  const visibleCollectionIdSet = new Set(visibleCollections.map((collection) => collection.id))
  const selectedVisibleCount = selectedCollectionIds.filter((id) => visibleCollectionIdSet.has(id)).length
  const allVisibleSelected = visibleCollections.length > 0 && selectedVisibleCount === visibleCollections.length

  const toggleCollectionSelection = (collectionId: string) => {
    setSelectedCollectionIds((current) => current.includes(collectionId) ? current.filter((id) => id !== collectionId) : [...current, collectionId])
  }

  const toggleVisibleCollections = () => {
    setSelectedCollectionIds((current) => {
      const selected = new Set(current)
      if (allVisibleSelected) visibleCollections.forEach((collection) => selected.delete(collection.id))
      else visibleCollections.forEach((collection) => selected.add(collection.id))
      return [...selected]
    })
  }

  const confirmDelete = () => {
    if (!collectionsToDelete?.length) return
    const ids = collectionsToDelete
    setCollectionsToDelete(null)
    startTransition(async () => {
      const result = await deleteCollectionsAction(ids)
      if (!result.success) {
        toast.error(result.message)
        return
      }
      setSelectedCollectionIds((current) => current.filter((id) => !ids.includes(id)))
      toast.success(result.count === 1 ? "Collection deleted." : `${result.count} collections deleted.`)
      router.refresh()
    })
  }

  return (
    <main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-5">
      <div className="w-full">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold"><Link2 className="size-4" /> Collections</h1>
            <p className="mt-1 text-xs text-black/55">Group products into curated storefront collections.</p>
          </div>
          <Link href="/dashboard/products/collections/new" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-3 text-xs font-medium text-white transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">
            <Plus className="size-3.5" /> Add collection
          </Link>
        </div>

        <section className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-black/10 px-4 py-3">
            <label className="flex h-9 min-w-52 flex-1 items-center gap-2 rounded-lg border border-black/15 bg-white px-3 text-sm text-black/50 transition focus-within:border-black focus-within:ring-2 focus-within:ring-black/10">
              <Search className="size-4" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search and filter collections" placeholder="Search collections" className="w-full bg-transparent outline-none placeholder:text-black/45" />
            </label>
            {selectedCollectionIds.length ? <button type="button" disabled={isPending} onClick={() => setCollectionsToDelete(selectedCollectionIds)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-60"><Trash2 className="size-3.5" /> Delete {selectedCollectionIds.length}</button> : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-xs">
              <thead className="bg-black/[0.025] text-black/65">
                <tr>
                  <th className="w-12 border-b border-black/10 px-3 py-2.5 font-medium"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisibleCollections} aria-label="Select all visible collections" className="size-4 rounded accent-black" /></th>
                  <th className="border-b border-black/10 px-3 py-2.5 font-medium">Collection</th>
                  <th className="w-24 border-b border-black/10 px-3 py-2.5 font-medium">Products</th>
                  <th className="w-28 border-b border-black/10 px-3 py-2.5 font-medium">Status</th>
                  <th className="w-24 border-b border-black/10 px-3 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {visibleCollections.map((collection) => (
                  <tr key={collection.id} className="transition hover:bg-black/[0.02]">
                    <td className="border-b border-black/10 px-3 py-2.5"><input type="checkbox" checked={selectedCollectionIds.includes(collection.id)} onChange={() => toggleCollectionSelection(collection.id)} aria-label={`Select ${collection.title}`} className="size-4 rounded accent-black" /></td>
                    <td className="border-b border-black/10 px-3 py-2.5">
                      <Link href={`/dashboard/products/collections/${collection.id}`} className="flex items-center gap-3 font-medium text-[#0c3152] outline-none transition hover:underline focus-visible:ring-2 focus-visible:ring-black">
                        {collection.image?.url ? <Image src={collection.image.url} alt={collection.image.altText || collection.title} width={40} height={40} sizes="40px" className="size-10 rounded-lg border border-black/10 object-cover" /> : <span className="flex size-10 items-center justify-center rounded-lg border border-black/10 bg-black/[0.04] text-xs font-semibold text-black/60">{collection.title.slice(0, 1).toUpperCase()}</span>}
                        <span><span className="block">{collection.title}</span><span className="mt-1 block text-[11px] font-normal text-black/45">/collections/{collection.slug}</span></span>
                      </Link>
                    </td>
                    <td className="border-b border-black/10 px-3 py-2.5 text-black/65">{collection.productCount}</td>
                    <td className="border-b border-black/10 px-3 py-2.5"><StatusBadge isPublished={collection.isPublished} /></td>
                    <td className="border-b border-black/10 px-3 py-2.5"><div className="flex items-center gap-1"><Link href={`/dashboard/products/collections/${collection.id}`} aria-label={`Edit ${collection.title}`} className="rounded-md p-1.5 text-black/50 transition hover:bg-black/[0.06] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"><Pencil className="size-3.5" /></Link><button type="button" disabled={isPending} onClick={() => setCollectionsToDelete([collection.id])} aria-label={`Delete ${collection.title}`} className="rounded-md p-1.5 text-black/50 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-60"><Trash2 className="size-3.5" /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!visibleCollections.length ? <div className="px-4 py-12 text-center"><p className="text-sm font-medium">No collections match your search.</p><p className="mt-1 text-xs text-black/55">Try a different term or create a new collection.</p></div> : null}
        </section>
      </div>

      <AlertDialog open={Boolean(collectionsToDelete?.length)} onOpenChange={(open) => { if (!open) setCollectionsToDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete {collectionsToDelete?.length === 1 ? "collection" : "collections"}?</AlertDialogTitle><AlertDialogDescription>Products will remain in your catalog but will be removed from these collections. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel><AlertDialogAction disabled={isPending} onClick={confirmDelete} className="bg-red-600 text-white hover:bg-red-700">{isPending ? <LoaderCircle className="animate-spin" /> : null}Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
