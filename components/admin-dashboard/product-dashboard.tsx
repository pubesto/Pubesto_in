"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useRef, useState, useTransition } from "react"
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileUp,
  Filter,
  LoaderCircle,
  MoreHorizontal,
  Plus,
  Search,
  Tag,
  Trash2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"

import { PRODUCT_CSV_COLUMNS, pageContentFromCsvRow } from "@/lib/product-csv"
import type { ProductPageContent } from "@/lib/product-page-content"

import {
  deleteProductsAction,
  importProductsAction,
  updateProductsStatusAction,
} from "@/app/actions/products"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
import type { AdminCategoryOption } from "@/lib/server/dal/categories"
import type {
  AdminCollectionOption,
  AdminProductListItem,
} from "@/lib/server/dal/products"

type StatusFilter = "ALL" | "ACTIVE" | "DRAFT" | "ARCHIVED"

type ImportedProductPayload = {
  title: string
  slug?: string
  sku?: string
  price: string
  compareAtPrice: string
  inventoryQuantity: string
  status: "ACTIVE" | "DRAFT"
  categoryId: string | null
  collectionIds: string[]
  tags: string[]
  images: string[]
  variants: []
  details: []
  description?: string
  pageContent?: Partial<ProductPageContent>
}

const pageSize = 50

function quoteCsv(value: string | number | null | undefined) {
  const stringValue = String(value ?? "")
  return /[",\n]/.test(stringValue)
    ? `"${stringValue.replaceAll('"', '""')}"`
    : stringValue
}

function parseCsv(source: string) {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentValue = ""
  let quoted = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]

    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        currentValue += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }

    if (character === "," && !quoted) {
      currentRow.push(currentValue)
      currentValue = ""
      continue
    }

    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") {
        index += 1
      }
      currentRow.push(currentValue)
      if (currentRow.some((value) => value.trim())) {
        rows.push(currentRow)
      }
      currentRow = []
      currentValue = ""
      continue
    }

    currentValue += character
  }

  currentRow.push(currentValue)
  if (currentRow.some((value) => value.trim())) {
    rows.push(currentRow)
  }

  if (rows.length < 2) {
    return []
  }

  const headers = rows[0].map((header) =>
    header.trim().toLowerCase().replace(/[^a-z0-9]/g, ""),
  )

  return rows.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ""])),
  )
}

function statusLabel(status: AdminProductListItem["status"]) {
  return status.slice(0, 1) + status.slice(1).toLowerCase()
}

function statusBadgeClass(status: AdminProductListItem["status"]) {
  if (status === "ACTIVE") return "bg-emerald-200 text-emerald-900"
  if (status === "ARCHIVED") return "bg-amber-100 text-amber-900"
  return "bg-black/[0.08] text-black/65"
}

export function ProductDashboard({
  products,
  categories,
  collections,
}: {
  products: AdminProductListItem[]
  categories: AdminCategoryOption[]
  collections: AdminCollectionOption[]
}) {
  const router = useRouter()
  const importInputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isMutating, startMutation] = useTransition()

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return products.filter((product) => {
      const queryMatches = !normalizedQuery || [
        product.title,
        product.slug,
        product.categoryName,
        ...product.tags,
        ...product.collectionNames,
      ].some((value) => value.toLowerCase().includes(normalizedQuery))
      const statusMatches = statusFilter === "ALL" || product.status === statusFilter
      const categoryMatches = categoryFilter === "ALL" || product.categoryName === categoryFilter
      const selectionMatches = !showSelectedOnly || selectedIds.includes(product.id)

      return queryMatches && statusMatches && categoryMatches && selectionMatches
    })
  }, [categoryFilter, products, query, selectedIds, showSelectedOnly, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize))
  const visiblePage = Math.min(page, totalPages)
  const pageStart = (visiblePage - 1) * pageSize
  const pageProducts = filteredProducts.slice(pageStart, pageStart + pageSize)
  const selectedPageCount = pageProducts.filter((product) => selectedIds.includes(product.id)).length
  const allPageSelected = pageProducts.length > 0 && selectedPageCount === pageProducts.length
  const totalInventory = products.reduce((total, product) => total + product.totalInventory, 0)
  const activeProducts = products.filter((product) => product.status === "ACTIVE").length
  const outOfStockProducts = products.filter((product) => product.totalInventory === 0).length

  function updateQuery(value: string) {
    setQuery(value)
    setPage(1)
  }

  function updateStatusFilter(value: StatusFilter) {
    setStatusFilter(value)
    setPage(1)
  }

  function updateCategoryFilter(value: string) {
    setCategoryFilter(value)
    setPage(1)
  }

  function toggleProduct(productId: string) {
    setSelectedIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    )
  }

  function togglePageSelection() {
    const pageIds = pageProducts.map((product) => product.id)
    setSelectedIds((current) =>
      allPageSelected
        ? current.filter((id) => !pageIds.includes(id))
        : [...new Set([...current, ...pageIds])],
    )
  }

  function exportProducts() {
    const headers = ["Title", "SKU", "Status", "Price", "Inventory", "Category", "Collections", "Tags", "Vendor"]
    const lines = filteredProducts.map((product) => [
      product.title,
      product.sku,
      statusLabel(product.status),
      product.minimumPrice,
      product.totalInventory,
      product.categoryName,
      product.collectionNames.join(" | "),
      product.tags.join(" | "),
      product.vendor,
    ].map(quoteCsv).join(","))
    const blob = new Blob([[headers.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "pubesto-products.csv"
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filteredProducts.length} ${filteredProducts.length === 1 ? "product" : "products"}`)
  }

  function deleteSelected() {
    if (selectedIds.length === 0) {
      return
    }

    startMutation(async () => {
      const result = await deleteProductsAction(selectedIds)
      if (!result.success) {
        toast.error(result.message)
        return
      }

      setSelectedIds([])
      setShowSelectedOnly(false)
      toast.success(`${result.count} ${result.count === 1 ? "product was" : "products were"} deleted`)
      router.refresh()
    })
  }

  function updateSelectedStatus(status: "ACTIVE" | "DRAFT") {
    if (selectedIds.length === 0) {
      return
    }

    startMutation(async () => {
      const result = await updateProductsStatusAction(selectedIds, status)
      if (!result.success) {
        toast.error(result.message)
        return
      }

      setSelectedIds([])
      setShowSelectedOnly(false)
      toast.success(`${result.count} ${result.count === 1 ? "product was" : "products were"} set as ${status.toLowerCase()}`)
      router.refresh()
    })
  }

  function clearSelection() {
    setSelectedIds([])
    setShowSelectedOnly(false)
  }

  function downloadTemplate() {
    const example = PRODUCT_CSV_COLUMNS.map((column) =>
      ({
        Title: "VINTAGE WASH BOOTCUT FIT DENIM",
        Price: "2800",
        "Compare at price": "3000",
        Status: "DRAFT",
        Collections: "Originals",
        "Short name": "Faded Years",
        Edit: "Originals",
        Gender: "MEN",
        Colour: "Grey Cirrus",
        Fit: "Bootcut Fit",
        Rise: "Mid",
        Stretch: "No",
        "Highlight strip": "BOOTCUT FIT: Opens from the knee | 100% COTTON: No stretch",
        Care: "Machine wash cold | Wash inside out | Dry in shade",
        "Model height": "5'9\"",
        "Model size": "32",
      } as Record<string, string>)[column] ?? "",
    )
    const csv = [PRODUCT_CSV_COLUMNS.map(quoteCsv).join(","), example.map(quoteCsv).join(",")].join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "pubesto-product-import-template.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  async function importCsv(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file) {
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Choose a CSV smaller than 2 MB.")
      return
    }

    const rows = parseCsv(await file.text())
    if (rows.length === 0) {
      toast.error("The CSV needs a header row and at least one product.")
      return
    }
    if (rows.length > 100) {
      toast.error("Import up to 100 products at a time.")
      return
    }

    const categoriesByName = new Map(categories.map((category) => [category.name.toLowerCase(), category.id]))
    const collectionsByName = new Map(collections.map((collection) => [collection.title.toLowerCase(), collection.id]))
    const importedProducts: ImportedProductPayload[] = []

    for (const [index, row] of rows.entries()) {
      const title = row.title
      const price = row.price
      const categoryName = (row.category ?? "").toLowerCase()
      const collectionNames = (row.collections ?? "").split("|").map((name) => name.trim()).filter(Boolean)
      const categoryId = categoryName ? categoriesByName.get(categoryName) : undefined
      const collectionIds = collectionNames.map((name) => collectionsByName.get(name.toLowerCase())).filter((id): id is string => Boolean(id))

      if (!title || !price) {
        toast.error(`Row ${index + 2} needs a title and price.`)
        return
      }
      if (categoryName && !categoryId) {
        toast.error(`Row ${index + 2} references an unknown category.`)
        return
      }
      if (collectionIds.length !== collectionNames.length) {
        toast.error(`Row ${index + 2} references an unknown collection.`)
        return
      }

      importedProducts.push({
        title,
        slug: row.slug || undefined,
        sku: row.sku || undefined,
        price,
        compareAtPrice: row.compareatprice || "",
        inventoryQuantity: row.inventoryquantity || row.quantity || "0",
        status: (row.status ?? "").toUpperCase() === "ACTIVE" ? "ACTIVE" : "DRAFT",
        categoryId: categoryId ?? null,
        collectionIds,
        tags: (row.tags ?? "").split("|").map((tag) => tag.trim()).filter(Boolean),
        images: [],
        variants: [],
        details: [],
        description: row.description || undefined,
        pageContent: pageContentFromCsvRow(row),
      })
    }

    startMutation(async () => {
      const result = await importProductsAction(importedProducts)
      if (!result.success) {
        toast.error(result.message)
        return
      }

      toast.success(`${result.count} ${result.count === 1 ? "product was" : "products were"} imported`)
      router.refresh()
    })
  }

  return (
    <main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-lg font-semibold"><Tag className="size-4" /> Products</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={exportProducts} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-black/[0.06] px-3 text-xs font-medium transition hover:bg-black/10"><Download className="size-3.5" /> Export</button>
          <button type="button" disabled={isMutating} onClick={() => importInputRef.current?.click()} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-black/[0.06] px-3 text-xs font-medium transition hover:bg-black/10 disabled:cursor-not-allowed disabled:opacity-50"><Upload className="size-3.5" /> Import</button>
          <button type="button" onClick={downloadTemplate} title="CSV with every column the import understands" className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-black/[0.06] px-3 text-xs font-medium transition hover:bg-black/10">Template</button>
          <input ref={importInputRef} onChange={importCsv} type="file" accept=".csv,text/csv" className="sr-only" />
          <Link href="/dashboard/products/new" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-black px-3 text-xs font-medium text-white transition hover:bg-black/80"><Plus className="size-3.5" /> Add product</Link>
        </div>
      </div>

      <section className="mt-3 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        <div className="grid grid-cols-2 divide-x divide-y divide-black/10 sm:grid-cols-2 lg:grid-cols-4 lg:divide-y-0">
          <div className="flex items-center gap-2 px-4 py-4 text-xs font-medium"><CalendarDays className="size-4" /> Catalogue overview</div>
          <div className="px-4 py-3"><p className="text-xs font-medium text-black/65">Active products</p><p className="mt-1 text-sm font-semibold">{activeProducts}<span className="ml-1 font-normal text-black/45">of {products.length}</span></p><div className="mt-2 h-0.5 w-11 bg-[#55c5f7]" /></div>
          <div className="px-4 py-3"><p className="text-xs font-medium text-black/65">Inventory units</p><p className="mt-1 text-sm font-semibold">{totalInventory.toLocaleString("en-IN")}</p><p className="mt-1 text-xs text-black/50">Across all variants</p></div>
          <div className="px-4 py-3"><p className="text-xs font-medium text-black/65">Out of stock</p><p className="mt-1 text-sm font-semibold">{outOfStockProducts}</p><p className="mt-1 text-xs text-black/50">Need attention</p></div>
        </div>
      </section>

      <section className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-black/10 px-4 py-3">
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-1.5 text-xs font-medium transition hover:bg-black/[0.05]">{statusFilter === "ALL" ? "All" : statusLabel(statusFilter)} <ChevronDown className="size-3.5" /></button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-36 gap-1 p-1.5">
              {(["ALL", "ACTIVE", "DRAFT", "ARCHIVED"] as StatusFilter[]).map((status) => <button key={status} type="button" onClick={() => updateStatusFilter(status)} className={`flex h-8 w-full cursor-pointer items-center rounded-md px-2 text-left text-sm transition ${statusFilter === status ? "bg-black/[0.06] font-medium" : "hover:bg-black/[0.04]"}`}>{status === "ALL" ? "All products" : statusLabel(status)}</button>)}
            </PopoverContent>
          </Popover>
          <label className="flex min-w-48 flex-1 items-center gap-2 text-sm text-black/50"><Search className="size-4" /><input value={query} onChange={(event) => updateQuery(event.target.value)} aria-label="Search products" placeholder="Search products, collections, or categories" className="w-full bg-transparent outline-none placeholder:text-black/45" /></label>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" aria-label="Filter by category" className={`grid size-8 cursor-pointer place-items-center rounded-md transition ${categoryFilter === "ALL" ? "text-black/55 hover:bg-black/5" : "bg-black text-white"}`}><Filter className="size-4" /></button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 gap-1 p-1.5"><p className="px-2 py-1 text-xs font-medium text-black/50">Filter by category</p><button type="button" onClick={() => updateCategoryFilter("ALL")} className={`flex h-8 w-full cursor-pointer items-center rounded-md px-2 text-left text-sm transition ${categoryFilter === "ALL" ? "bg-black/[0.06] font-medium" : "hover:bg-black/[0.04]"}`}>All categories</button>{categories.map((category) => <button key={category.id} type="button" onClick={() => updateCategoryFilter(category.name)} className={`flex h-8 w-full cursor-pointer items-center rounded-md px-2 text-left text-sm transition ${categoryFilter === category.name ? "bg-black/[0.06] font-medium" : "hover:bg-black/[0.04]"}`}>{category.name}</button>)}</PopoverContent>
          </Popover>
          <span className="text-xs text-black/45">{filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] table-fixed border-collapse text-left text-xs">
            <colgroup>
              <col className="w-[5%]" />
              <col className="w-[37%]" />
              <col className="w-[12%]" />
              <col className="w-[20%]" />
              <col className="w-[12%]" />
              <col className="w-[14%]" />
            </colgroup>
            <thead className="bg-black/[0.025] text-black/65">{selectedIds.length > 0 ? <tr><th colSpan={6} className="border-b border-black/10 px-3 py-1"><div className="flex h-8 items-center gap-2 text-black"><input type="checkbox" checked onChange={clearSelection} aria-label="Clear product selection" className="size-4 cursor-pointer accent-black" /><span className="mr-1 text-xs font-semibold">{selectedIds.length} selected</span><button type="button" onClick={() => updateSelectedStatus("ACTIVE")} disabled={isMutating} className="inline-flex h-7 cursor-pointer items-center rounded-md border border-black/15 bg-white px-2.5 text-xs font-medium text-black/75 transition hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50">Set as active</button><button type="button" onClick={() => updateSelectedStatus("DRAFT")} disabled={isMutating} className="inline-flex h-7 cursor-pointer items-center rounded-md border border-black/15 bg-white px-2.5 text-xs font-medium text-black/75 transition hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50">Set as draft</button><Popover><PopoverTrigger asChild><button type="button" disabled={isMutating} aria-label="More selected product actions" className="grid size-7 cursor-pointer place-items-center rounded-md border border-black/15 bg-white text-black/70 transition hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50"><MoreHorizontal className="size-4" /></button></PopoverTrigger><PopoverContent align="start" className="w-44 gap-1 p-1.5"><button type="button" onClick={() => setDeleteDialogOpen(true)} className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-sm text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"><Trash2 className="size-3.5" /> Delete selected</button></PopoverContent></Popover><label className="ml-auto flex h-7 cursor-pointer items-center gap-2 rounded-md px-2 text-xs font-medium text-black/65 transition hover:bg-black/[0.04]"><input type="checkbox" checked={showSelectedOnly} onChange={(event) => { setShowSelectedOnly(event.target.checked); setPage(1) }} className="size-4 accent-black" />Show all selected</label></div></th></tr> : <tr><th className="border-b border-black/10 px-3 py-2.5 font-medium"><input type="checkbox" checked={allPageSelected} onChange={togglePageSelection} aria-label="Select products on this page" className="size-4 accent-black" /></th><th className="border-b border-black/10 px-3 py-2.5 font-medium">Product</th><th className="border-b border-black/10 px-3 py-2.5 font-medium">Status</th><th className="border-b border-black/10 px-3 py-2.5 font-medium">Inventory</th><th className="border-b border-black/10 px-3 py-2.5 font-medium">Category</th><th className="border-b border-black/10 px-3 py-2.5 font-medium">Collections</th></tr>}</thead>
            <tbody>{pageProducts.length > 0 ? pageProducts.map((product) => <tr key={product.id} tabIndex={0} aria-label={`Open ${product.title} details`} onClick={(event) => { if (!(event.target as HTMLElement).closest("input")) router.push(`/dashboard/products/${product.id}`) }} onKeyDown={(event) => { if (!(event.target as HTMLElement).closest("input") && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); router.push(`/dashboard/products/${product.id}`) } }} className={`cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/30 ${selectedIds.includes(product.id) ? "bg-black/[0.025] hover:bg-black/[0.04]" : "bg-white hover:bg-black/[0.02]"}`}><td className="border-b border-black/10 px-3 py-2"><input type="checkbox" checked={selectedIds.includes(product.id)} onChange={() => toggleProduct(product.id)} aria-label={`Select ${product.title}`} className="size-4 cursor-pointer accent-black" /></td><td className="border-b border-black/10 px-3 py-2"><div className="flex items-center gap-3 font-medium">{product.image?.url ? <Image src={product.image.url} alt={product.image.altText || product.title} width={40} height={40} sizes="40px" className="size-10 rounded-md border border-black/10 object-cover" /> : <span className="grid size-10 place-items-center rounded-md border border-black/10 bg-black/[0.04] text-sm text-black/45">{product.title.slice(0, 1).toUpperCase()}</span>}<span className="max-w-72 truncate text-black/85">{product.title}</span></div></td><td className="border-b border-black/10 px-3 py-2"><span className={`rounded-full px-2 py-1 ${statusBadgeClass(product.status)}`}>{statusLabel(product.status)}</span></td><td className="border-b border-black/10 px-3 py-2">{`${product.totalInventory} in stock for ${product.variantCount} ${product.variantCount === 1 ? "variant" : "variants"}`}</td><td className="border-b border-black/10 px-3 py-2">{product.categoryName}</td><td className="border-b border-black/10 px-3 py-2"><div className="flex max-w-56 flex-wrap gap-1">{product.collectionNames.length > 0 ? product.collectionNames.map((collection) => <span key={collection} className="rounded bg-black/[0.06] px-1.5 py-1 text-[11px] font-medium text-black/65">{collection}</span>) : <span className="text-black/40">—</span>}</div></td></tr>) : <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-black/55">{products.length === 0 ? "No products yet. Add your first product to start building the catalogue." : "No products match these filters."}</td></tr>}</tbody>
          </table>
        </div>
        <div className="flex items-center gap-1 border-t border-black/10 px-3 py-2 text-xs text-black/60"><button type="button" aria-label="Previous page" disabled={visiblePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-md bg-black/5 p-1 transition hover:bg-black/10 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="size-4" /></button><button type="button" aria-label="Next page" disabled={visiblePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-md bg-black/5 p-1 transition hover:bg-black/10 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight className="size-4" /></button><span className="ml-1">{filteredProducts.length === 0 ? "0" : `${pageStart + 1}–${Math.min(pageStart + pageSize, filteredProducts.length)}`} of {filteredProducts.length}</span>{isMutating ? <span className="ml-auto flex items-center gap-1.5"><LoaderCircle className="size-3.5 animate-spin" />Updating catalogue…</span> : null}</div>
      </section>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected products?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes {selectedIds.length} {selectedIds.length === 1 ? "product" : "products"}, including their variants, image records, and collection assignments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={isMutating} onClick={deleteSelected}>
              {isMutating ? "Deleting…" : `Delete ${selectedIds.length === 1 ? "product" : "products"}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-black/45"><FileUp className="size-3.5" /> CSV import supports title, price, SKU, quantity, status, category, collections, and tags.</p>
    </main>
  )
}
