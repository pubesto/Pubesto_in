"use client"

import Image from "next/image"
import Link from "next/link"
import { useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  LoaderCircle,
  PackagePlus,
  Search,
  Upload,
  Warehouse,
  X,
} from "lucide-react"
import { toast } from "sonner"

import {
  importInventoryAction,
  updateInventoryQuantitiesAction,
  updateInventoryQuantityAction,
} from "@/app/actions/inventory"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { AdminInventoryItem } from "@/lib/server/dal/inventory"

type StockFilter = "ALL" | "AVAILABLE" | "LOW" | "OUT"

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
      if (character === "\r" && source[index + 1] === "\n") index += 1
      currentRow.push(currentValue)
      if (currentRow.some((value) => value.trim())) rows.push(currentRow)
      currentRow = []
      currentValue = ""
      continue
    }
    currentValue += character
  }

  currentRow.push(currentValue)
  if (currentRow.some((value) => value.trim())) rows.push(currentRow)
  if (rows.length < 2) return []

  const headers = rows[0].map((header) =>
    header.trim().toLowerCase().replace(/[^a-z0-9]/g, ""),
  )
  return rows.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ""])),
  )
}

function filterLabel(filter: StockFilter) {
  if (filter === "AVAILABLE") return "Available"
  if (filter === "LOW") return "Low stock"
  if (filter === "OUT") return "Out of stock"
  return "All inventory"
}

function InventoryThumbnail({ item }: { item: AdminInventoryItem }) {
  if (!item.image?.url) {
    return <span className="grid size-10 shrink-0 place-items-center rounded-md border border-black/10 bg-black/[0.04] text-sm font-medium text-black/45">{item.productTitle.slice(0, 1).toUpperCase()}</span>
  }

  return <Image src={item.image.url} alt={item.image.altText || item.productTitle} width={40} height={40} sizes="40px" className="size-10 shrink-0 rounded-md border border-black/10 object-cover" />
}

export function InventoryManager({
  initialItems,
}: {
  initialItems: AdminInventoryItem[]
}) {
  const router = useRouter()
  const importInputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [stockFilter, setStockFilter] = useState<StockFilter>("ALL")
  const [page, setPage] = useState(1)
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([])
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)
  const [quantityOverrides, setQuantityOverrides] = useState<Record<string, number>>({})
  const [editingItem, setEditingItem] = useState<AdminInventoryItem | null>(null)
  const [editingOnHand, setEditingOnHand] = useState("")
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkOnHand, setBulkOnHand] = useState("")
  const [isMutating, startMutation] = useTransition()

  const items = useMemo(() => initialItems.map((item) => {
    const onHand = quantityOverrides[item.variantId] ?? item.onHand
    return { ...item, onHand, available: Math.max(onHand - item.committed - item.unavailable, 0) }
  }), [initialItems, quantityOverrides])
  const normalizedQuery = query.trim().toLowerCase()
  const filteredItems = useMemo(() => items.filter((item) => {
    const queryMatches = !normalizedQuery || [item.productTitle, item.productSlug, item.variantTitle, item.sku].some((value) => value.toLowerCase().includes(normalizedQuery))
    const stockMatches = stockFilter === "ALL"
      || (stockFilter === "AVAILABLE" && item.available > 0)
      || (stockFilter === "LOW" && item.available > 0 && item.available <= 10)
      || (stockFilter === "OUT" && item.available === 0)
    const selectionMatches = !showSelectedOnly || selectedVariantIds.includes(item.variantId)
    return queryMatches && stockMatches && selectionMatches
  }), [items, normalizedQuery, selectedVariantIds, showSelectedOnly, stockFilter])
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const visiblePage = Math.min(page, totalPages)
  const startIndex = (visiblePage - 1) * pageSize
  const pageItems = filteredItems.slice(startIndex, startIndex + pageSize)
  const selectedPageCount = pageItems.filter((item) => selectedVariantIds.includes(item.variantId)).length
  const allPageSelected = pageItems.length > 0 && selectedPageCount === pageItems.length
  const selectedItems = items.filter((item) => selectedVariantIds.includes(item.variantId))
  const onHandTotal = items.reduce((total, item) => total + item.onHand, 0)
  const availableTotal = items.reduce((total, item) => total + item.available, 0)
  const committedTotal = items.reduce((total, item) => total + item.committed, 0)
  const lowStockCount = items.filter((item) => item.available > 0 && item.available <= 10).length

  const updateQuery = (value: string) => {
    setQuery(value)
    setPage(1)
  }

  const updateStockFilter = (filter: StockFilter) => {
    setStockFilter(filter)
    setPage(1)
  }

  const toggleVariant = (variantId: string) => {
    setSelectedVariantIds((current) => current.includes(variantId) ? current.filter((id) => id !== variantId) : [...current, variantId])
  }

  const togglePageSelection = () => {
    const pageIds = pageItems.map((item) => item.variantId)
    setSelectedVariantIds((current) => allPageSelected ? current.filter((id) => !pageIds.includes(id)) : [...new Set([...current, ...pageIds])])
  }

  const clearSelection = () => {
    setSelectedVariantIds([])
    setShowSelectedOnly(false)
  }

  const openSingleAdjustment = (item: AdminInventoryItem) => {
    setEditingItem(item)
    setEditingOnHand(String(item.onHand))
  }

  const validateQuantity = (value: string) => {
    if (!value.trim()) return null
    const quantity = Number(value)
    return Number.isInteger(quantity) && quantity >= 0 && quantity <= 10_000_000
      ? quantity
      : null
  }

  const saveSingleAdjustment = () => {
    if (!editingItem) return
    const onHand = validateQuantity(editingOnHand)
    if (onHand === null) {
      toast.error("Enter a whole number from 0 to 10,000,000.")
      return
    }

    const item = editingItem
    startMutation(async () => {
      const result = await updateInventoryQuantityAction({ variantId: item.variantId, onHand })
      if (!result.success) {
        toast.error(result.message)
        return
      }
      setQuantityOverrides((current) => ({ ...current, [item.variantId]: onHand }))
      setEditingItem(null)
      toast.success(`Updated ${item.productTitle} inventory.`)
      router.refresh()
    })
  }

  const saveBulkAdjustment = () => {
    const onHand = validateQuantity(bulkOnHand)
    if (onHand === null) {
      toast.error("Enter a whole number from 0 to 10,000,000.")
      return
    }
    if (!selectedItems.length) return

    const updates = selectedItems.map((item) => ({ variantId: item.variantId, onHand }))
    startMutation(async () => {
      const result = await updateInventoryQuantitiesAction(updates)
      if (!result.success) {
        toast.error(result.message)
        return
      }
      setQuantityOverrides((current) => ({
        ...current,
        ...Object.fromEntries(updates.map((update) => [update.variantId, update.onHand])),
      }))
      setBulkOpen(false)
      clearSelection()
      toast.success(`Updated ${result.count} ${result.count === 1 ? "variant" : "variants"}.`)
      router.refresh()
    })
  }

  const exportInventory = () => {
    const headers = ["Product", "Variant", "SKU", "Unavailable", "Committed", "Available", "On hand", "Incoming"]
    const lines = filteredItems.map((item) => [item.productTitle, item.variantTitle, item.sku, item.unavailable, item.committed, item.available, item.onHand, item.incoming].map(quoteCsv).join(","))
    const blob = new Blob([[headers.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "pubesto-inventory.csv"
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filteredItems.length} ${filteredItems.length === 1 ? "inventory row" : "inventory rows"}.`)
  }

  const importInventory = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Choose a CSV smaller than 2 MB.")
      return
    }

    const rows = parseCsv(await file.text())
    if (!rows.length) {
      toast.error("The CSV needs a header row and at least one inventory row.")
      return
    }
    if (rows.length > 500) {
      toast.error("Import up to 500 inventory rows at a time.")
      return
    }

    const updates: Array<{ sku: string; onHand: number }> = []
    for (const [index, row] of rows.entries()) {
      const sku = row.sku?.toUpperCase()
      const onHandValue = row.onhand || row.quantity || row.inventory
      const onHand = validateQuantity(onHandValue)
      if (!sku || onHand === null) {
        toast.error(`Row ${index + 2} needs a SKU and whole-number On hand quantity.`)
        return
      }
      updates.push({ sku, onHand })
    }

    startMutation(async () => {
      const result = await importInventoryAction(updates)
      if (!result.success) {
        toast.error(result.message)
        return
      }
      const itemBySku = new Map(items.map((item) => [item.sku, item]))
      setQuantityOverrides((current) => ({
        ...current,
        ...Object.fromEntries(updates.flatMap((update) => {
          const item = itemBySku.get(update.sku)
          return item ? [[item.variantId, update.onHand]] : []
        })),
      }))
      toast.success(`Imported inventory for ${result.count} ${result.count === 1 ? "variant" : "variants"}.`)
      router.refresh()
    })
  }

  return (
    <main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-5">
      <div className="w-full">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold"><Warehouse className="size-4" /> Inventory</h1>
            <p className="mt-1 text-xs text-black/55">Track and adjust stock for each product variant.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={exportInventory} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black/[0.06] px-3 text-xs font-medium transition hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"><Download className="size-3.5" /> Export</button>
            <button type="button" disabled={isMutating} onClick={() => importInputRef.current?.click()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black/[0.06] px-3 text-xs font-medium transition hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:cursor-not-allowed disabled:opacity-60"><Upload className="size-3.5" /> Import</button>
            <input ref={importInputRef} type="file" accept=".csv,text/csv" onChange={importInventory} className="sr-only" />
          </div>
        </header>

        <section className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
          <div className="grid grid-cols-2 divide-x divide-y divide-black/10 sm:grid-cols-2 lg:grid-cols-4 lg:divide-y-0">
            <div className="flex items-center gap-2 px-4 py-4 text-xs font-medium"><Warehouse className="size-4" /> Inventory overview</div>
            <div className="px-4 py-3"><p className="text-xs font-medium text-black/65">On hand</p><p className="mt-1 text-sm font-semibold">{onHandTotal.toLocaleString("en-IN")}</p><p className="mt-1 text-xs text-black/50">Across all variants</p></div>
            <div className="px-4 py-3"><p className="text-xs font-medium text-black/65">Available</p><p className="mt-1 text-sm font-semibold">{availableTotal.toLocaleString("en-IN")}</p><p className="mt-1 text-xs text-black/50">Ready to sell</p></div>
            <div className="px-4 py-3"><p className="text-xs font-medium text-black/65">Needs attention</p><p className="mt-1 text-sm font-semibold">{lowStockCount}</p><p className="mt-1 text-xs text-black/50">Low-stock variants · {committedTotal} committed</p></div>
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-black/10 px-4 py-3">
            <Popover>
              <PopoverTrigger asChild><button type="button" className="inline-flex h-8 items-center gap-1 rounded-md px-1.5 text-xs font-medium transition hover:bg-black/[0.05]">{filterLabel(stockFilter)} <ChevronDown className="size-3.5" /></button></PopoverTrigger>
              <PopoverContent align="start" className="w-40 gap-1 p-1.5">{(["ALL", "AVAILABLE", "LOW", "OUT"] as StockFilter[]).map((filter) => <button key={filter} type="button" onClick={() => updateStockFilter(filter)} className={`flex h-8 w-full items-center rounded-md px-2 text-left text-sm transition ${stockFilter === filter ? "bg-black/[0.06] font-medium" : "hover:bg-black/[0.04]"}`}>{filterLabel(filter)}</button>)}</PopoverContent>
            </Popover>
            <label className="flex min-w-48 flex-1 items-center gap-2 text-sm text-black/50"><Search className="size-4" /><input value={query} onChange={(event) => updateQuery(event.target.value)} aria-label="Search inventory" placeholder="Search product, variant, or SKU" className="w-full bg-transparent outline-none placeholder:text-black/45" /></label>
            <span className="text-xs text-black/45">{filteredItems.length} {filteredItems.length === 1 ? "variant" : "variants"}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] border-collapse text-left text-xs">
              <thead className="bg-black/[0.025] text-black/65">
                {selectedVariantIds.length ? (
                  <tr><th colSpan={9} className="border-b border-black/10 px-3 py-1"><div className="flex h-8 items-center gap-2"><button type="button" onClick={clearSelection} aria-label="Clear inventory selection" className="grid size-7 place-items-center rounded-md text-black/60 transition hover:bg-black/[0.06]"><X className="size-4" /></button><span className="mr-1 text-xs font-semibold">{selectedVariantIds.length} selected</span><button type="button" disabled={isMutating} onClick={() => { setBulkOnHand(""); setBulkOpen(true) }} className="inline-flex h-7 items-center gap-1.5 rounded-md border border-black/15 bg-white px-2.5 text-xs font-medium text-black/75 transition hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50"><PackagePlus className="size-3.5" /> Set on hand</button><label className="ml-auto flex h-7 items-center gap-2 rounded-md px-2 text-xs font-medium text-black/65 transition hover:bg-black/[0.04]"><input type="checkbox" checked={showSelectedOnly} onChange={(event) => { setShowSelectedOnly(event.target.checked); setPage(1) }} className="size-4 accent-black" /> Show selected</label></div></th></tr>
                ) : null}
                <tr>
                  <th className="w-12 border-b border-black/10 px-3 py-2.5 font-medium"><input type="checkbox" checked={allPageSelected} onChange={togglePageSelection} aria-label="Select inventory items on this page" className="size-4 accent-black" /></th>
                  <th className="min-w-[360px] border-b border-black/10 px-3 py-2.5 font-medium">Product</th>
                  <th className="min-w-[180px] border-b border-black/10 px-3 py-2.5 font-medium">SKU</th>
                  <th className="border-b border-black/10 px-3 py-2.5 text-center font-medium" title="Units that are not available for sale. This store does not currently track unavailable stock.">Unavailable</th>
                  <th className="border-b border-black/10 px-3 py-2.5 text-center font-medium" title="Units allocated to pending or confirmed orders.">Committed</th>
                  <th className="border-b border-black/10 px-3 py-2.5 text-center font-medium" title="On-hand units less committed and unavailable units.">Available</th>
                  <th className="border-b border-black/10 px-3 py-2.5 text-center font-medium" title="Physical stock. Select to adjust.">On hand</th>
                  <th className="border-b border-black/10 px-3 py-2.5 text-center font-medium" title="This store does not currently track incoming transfers.">Incoming</th>
                  <th className="w-16 border-b border-black/10 px-3 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {pageItems.length ? pageItems.map((item) => (
                  <tr key={item.variantId} className={selectedVariantIds.includes(item.variantId) ? "bg-black/[0.025]" : "transition hover:bg-black/[0.02]"}>
                    <td className="border-b border-black/10 px-3 py-2.5"><input type="checkbox" checked={selectedVariantIds.includes(item.variantId)} onChange={() => toggleVariant(item.variantId)} aria-label={`Select ${item.productTitle} ${item.variantTitle}`} className="size-4 accent-black" /></td>
                    <td className="border-b border-black/10 px-3 py-2.5"><Link href={`/dashboard/products/${item.productId}`} className="flex items-center gap-3 outline-none transition hover:underline focus-visible:ring-2 focus-visible:ring-black"><InventoryThumbnail item={item} /><span className="min-w-0"><span className="block truncate font-medium text-[#0c3152]">{item.productTitle}</span><span className="mt-1 block text-[11px] text-black/50">{item.variantTitle === "Default" ? "Default variant" : item.variantTitle}</span></span></Link></td>
                    <td className="border-b border-black/10 px-3 py-2.5 font-mono text-[11px] text-black/65">{item.sku}</td>
                    <td className="border-b border-black/10 px-3 py-2.5 text-center text-black/65">{item.unavailable}</td>
                    <td className="border-b border-black/10 px-3 py-2.5 text-center text-black/65">{item.committed}</td>
                    <td className={`border-b border-black/10 px-3 py-2.5 text-center font-medium ${item.available === 0 ? "text-red-700" : item.available <= 10 ? "text-amber-700" : "text-black/80"}`}>{item.available}</td>
                    <td className="border-b border-black/10 px-3 py-2.5 text-center"><button type="button" disabled={isMutating} onClick={() => openSingleAdjustment(item)} className="min-w-10 rounded-md px-2 py-1 font-medium text-[#0c3152] transition hover:bg-black/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:cursor-not-allowed disabled:opacity-50">{item.onHand}</button></td>
                    <td className="border-b border-black/10 px-3 py-2.5 text-center text-black/65">{item.incoming}</td>
                    <td className="border-b border-black/10 px-3 py-2.5"><button type="button" disabled={isMutating} onClick={() => openSingleAdjustment(item)} aria-label={`Adjust ${item.productTitle} inventory`} className="grid size-7 place-items-center rounded-md text-black/50 transition hover:bg-black/[0.06] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:cursor-not-allowed disabled:opacity-50"><Filter className="size-3.5" /></button></td>
                  </tr>
                )) : <tr><td colSpan={9} className="px-4 py-12 text-center"><p className="text-sm font-medium">No inventory items match these filters.</p><p className="mt-1 text-xs text-black/55">Try a different search or stock filter.</p></td></tr>}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-black/10 px-3 py-2 text-xs text-black/60">
            <span>{filteredItems.length ? `${startIndex + 1}–${Math.min(startIndex + pageSize, filteredItems.length)} of ${filteredItems.length}` : "0 items"}</span>
            <div className="flex items-center gap-1"><button type="button" disabled={visiblePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous page" className="grid size-7 place-items-center rounded-md bg-black/5 transition hover:bg-black/10 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="size-4" /></button><button type="button" disabled={visiblePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} aria-label="Next page" className="grid size-7 place-items-center rounded-md bg-black/5 transition hover:bg-black/10 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight className="size-4" /></button></div>
          </div>
        </section>
      </div>

      <Dialog open={Boolean(editingItem)} onOpenChange={(open) => { if (!open && !isMutating) setEditingItem(null) }}>
        <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:!w-[460px] sm:!max-w-[460px]" overlayClassName="bg-black/45 supports-backdrop-filter:backdrop-blur-[1px]">
          <DialogHeader className="border-b border-black/10 px-5 py-4"><DialogTitle>Adjust inventory</DialogTitle><DialogDescription>{editingItem ? `${editingItem.productTitle} · ${editingItem.variantTitle === "Default" ? "Default variant" : editingItem.variantTitle}` : ""}</DialogDescription></DialogHeader>
          <div className="space-y-4 px-5 py-4"><label className="grid gap-1.5 text-sm font-medium" htmlFor="inventory-on-hand"><span>On hand</span><input id="inventory-on-hand" autoFocus inputMode="numeric" min="0" max="10000000" type="number" value={editingOnHand} onChange={(event) => setEditingOnHand(event.target.value)} className="h-10 rounded-lg border border-black/25 bg-white px-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10" /></label>{editingItem ? <div className="grid grid-cols-2 gap-3 rounded-lg border border-black/10 bg-black/[0.02] p-3 text-xs"><span className="text-black/60">Committed <strong className="ml-1 text-black">{editingItem.committed}</strong></span><span className="text-black/60">Available after update <strong className="ml-1 text-black">{Math.max((validateQuantity(editingOnHand) ?? editingItem.onHand) - editingItem.committed - editingItem.unavailable, 0)}</strong></span></div> : null}</div>
          <DialogFooter className="flex-row justify-end border-t border-black/10 px-5 py-3"><button type="button" disabled={isMutating} onClick={() => setEditingItem(null)} className="h-9 rounded-lg border border-black/15 px-3 text-sm font-medium transition hover:bg-black/[0.03] disabled:opacity-50">Cancel</button><button type="button" disabled={isMutating} onClick={saveSingleAdjustment} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-3 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/30">{isMutating ? <LoaderCircle className="size-3.5 animate-spin" /> : null}Save</button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={(open) => { if (!open && !isMutating) setBulkOpen(false) }}>
        <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:!w-[460px] sm:!max-w-[460px]" overlayClassName="bg-black/45 supports-backdrop-filter:backdrop-blur-[1px]">
          <DialogHeader className="border-b border-black/10 px-5 py-4"><DialogTitle>Set inventory for {selectedItems.length} {selectedItems.length === 1 ? "variant" : "variants"}</DialogTitle><DialogDescription>This sets the same on-hand quantity for each selected variant.</DialogDescription></DialogHeader>
          <div className="px-5 py-4"><label className="grid gap-1.5 text-sm font-medium" htmlFor="bulk-inventory-on-hand"><span>On hand</span><input id="bulk-inventory-on-hand" autoFocus inputMode="numeric" min="0" max="10000000" type="number" value={bulkOnHand} onChange={(event) => setBulkOnHand(event.target.value)} className="h-10 rounded-lg border border-black/25 bg-white px-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10" /></label></div>
          <DialogFooter className="flex-row justify-end border-t border-black/10 px-5 py-3"><button type="button" disabled={isMutating} onClick={() => setBulkOpen(false)} className="h-9 rounded-lg border border-black/15 px-3 text-sm font-medium transition hover:bg-black/[0.03] disabled:opacity-50">Cancel</button><button type="button" disabled={isMutating} onClick={saveBulkAdjustment} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-3 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/30">{isMutating ? <LoaderCircle className="size-3.5 animate-spin" /> : null}Save inventory</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
