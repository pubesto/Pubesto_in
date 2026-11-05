"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { BadgePercent, Download, LoaderCircle, Search, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import {
  deleteDiscountsAction,
  setDiscountStatusAction,
} from "@/app/actions/discounts"
import { CreateDiscountDialog } from "@/components/admin-dashboard/create-discount-dialog"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { AdminDiscountListItem } from "@/lib/server/dal/discounts"

type StatusFilter = "ALL" | AdminDiscountListItem["status"]

function typeLabel(type: AdminDiscountListItem["type"]) {
  if (type === "PRODUCT") return "Amount off products"
  if (type === "ORDER") return "Amount off order"
  if (type === "BUY_X_GET_Y") return "Buy X get Y"
  return "Free shipping"
}

function valueLabel(discount: AdminDiscountListItem) {
  if (discount.valueType === "FREE") return "Free"
  if (discount.valueType === "PERCENTAGE") return `${discount.value}% off`
  return `₹${discount.value?.toLocaleString("en-IN", { minimumFractionDigits: 2 })} off`
}

function summary(discount: AdminDiscountListItem) {
  const parts = [valueLabel(discount)]
  if (discount.type === "PRODUCT") {
    if (discount.appliesTo === "PRODUCTS") parts.push(`${discount.productCount} ${discount.productCount === 1 ? "product" : "products"}`)
    if (discount.appliesTo === "COLLECTIONS") parts.push(`${discount.collectionCount} ${discount.collectionCount === 1 ? "collection" : "collections"}`)
  }
  if (discount.type === "BUY_X_GET_Y") parts.push(`Buy ${discount.buyProductCount}, get ${discount.getProductCount}`)
  if (discount.minimumType === "QUANTITY") parts.push(`Minimum quantity of ${discount.minimumValue}`)
  if (discount.minimumType === "AMOUNT") parts.push(`Minimum order ₹${discount.minimumValue}`)
  return parts.join(" · ")
}

function quoteCsv(value: string | number) {
  const stringValue = String(value)
  return /[",\n]/.test(stringValue) ? `"${stringValue.replaceAll('"', '""')}"` : stringValue
}

export function DiscountManager({ discounts }: { discounts: AdminDiscountListItem[] }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("ALL")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const normalizedQuery = query.trim().toLowerCase()
  const visibleDiscounts = useMemo(
    () => discounts.filter((discount) => {
      const matches = !normalizedQuery || [discount.title, discount.code ?? "", typeLabel(discount.type), discount.method].some((value) => value.toLowerCase().includes(normalizedQuery))
      return matches && (status === "ALL" || discount.status === status)
    }),
    [discounts, normalizedQuery, status],
  )
  const allSelected = visibleDiscounts.length > 0 && visibleDiscounts.every((discount) => selectedIds.includes(discount.id))

  const toggleAll = () => {
    const ids = visibleDiscounts.map((discount) => discount.id)
    setSelectedIds((current) => allSelected ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])])
  }
  const toggleDiscount = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((currentId) => currentId !== id) : [...current, id])

  const changeStatus = (nextStatus: "ACTIVE" | "INACTIVE") => {
    const ids = selectedIds
    if (!ids.length) return
    startTransition(async () => {
      const result = await setDiscountStatusAction({ ids, status: nextStatus })
      if (!result.success) {
        toast.error(result.message)
        return
      }
      setSelectedIds([])
      toast.success(`${result.count} ${result.count === 1 ? "discount" : "discounts"} ${nextStatus === "ACTIVE" ? "activated" : "deactivated"}.`)
      router.refresh()
    })
  }

  const deleteSelected = () => {
    const ids = selectedIds
    if (!ids.length) return
    startTransition(async () => {
      const result = await deleteDiscountsAction(ids)
      if (!result.success) {
        toast.error(result.message)
        return
      }
      setSelectedIds([])
      toast.success(`Deleted ${result.count} ${result.count === 1 ? "discount" : "discounts"}.`)
      router.refresh()
    })
  }

  const exportDiscounts = () => {
    const headers = ["Title", "Code", "Status", "Method", "Type", "Details", "Used"]
    const rows = visibleDiscounts.map((discount) => [discount.title, discount.code ?? "", discount.status, discount.method, typeLabel(discount.type), summary(discount), discount.usageCount].map(quoteCsv).join(","))
    const url = URL.createObjectURL(new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "pubesto-discounts.csv"
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${visibleDiscounts.length} discounts.`)
  }

  return <main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-5"><div className="w-full"><header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-lg font-semibold"><BadgePercent className="size-4" />Discounts</h1><p className="mt-1 text-xs text-black/55">Create customer offers, control their availability, and track their use.</p></div><div className="flex items-center gap-2"><button type="button" onClick={exportDiscounts} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black/[0.06] px-3 text-xs font-medium transition hover:bg-black/10"><Download className="size-3.5" />Export</button><CreateDiscountDialog /></div></header><section className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm"><div className="flex flex-wrap items-center gap-3 border-b border-black/10 px-4 py-3"><label className="flex min-w-52 flex-1 items-center gap-2 text-sm text-black/50"><Search className="size-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search discounts" placeholder="Search discounts by title or code" className="w-full bg-transparent outline-none placeholder:text-black/45" /></label><Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}><SelectTrigger aria-label="Filter discounts by status" className="h-8 w-36 rounded-md border-black/15 bg-white px-2 text-xs font-medium shadow-none"><SelectValue /></SelectTrigger><SelectContent position="popper"><SelectItem value="ALL">All discounts</SelectItem><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="INACTIVE">Inactive</SelectItem></SelectContent></Select><span className="text-xs text-black/45">{visibleDiscounts.length} {visibleDiscounts.length === 1 ? "discount" : "discounts"}</span></div>{selectedIds.length ? <div className="flex flex-wrap items-center gap-2 border-b border-black/10 bg-black/[0.02] px-3 py-2"><button type="button" onClick={() => setSelectedIds([])} aria-label="Clear discount selection" className="grid size-7 place-items-center rounded-md text-black/55 transition hover:bg-black/[0.06]"><X className="size-4" /></button><span className="text-xs font-semibold">{selectedIds.length} selected</span><button type="button" disabled={isPending} onClick={() => changeStatus("ACTIVE")} className="h-7 rounded-md border border-black/15 bg-white px-2.5 text-xs font-medium transition hover:bg-black/[0.04] disabled:opacity-50">Activate</button><button type="button" disabled={isPending} onClick={() => changeStatus("INACTIVE")} className="h-7 rounded-md border border-black/15 bg-white px-2.5 text-xs font-medium transition hover:bg-black/[0.04] disabled:opacity-50">Deactivate</button><button type="button" disabled={isPending} onClick={() => setDeleteOpen(true)} className="inline-flex h-7 items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"><Trash2 className="size-3" />Delete</button></div> : null}<div className="overflow-x-auto"><table className="w-full min-w-[1020px] border-collapse text-left text-xs"><thead className="bg-black/[0.025] text-black/65"><tr><th className="w-12 border-b border-black/10 px-3 py-2.5"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all visible discounts" className="size-4 accent-black" /></th><th className="border-b border-black/10 px-3 py-2.5 font-medium">Title</th><th className="border-b border-black/10 px-3 py-2.5 font-medium">Status</th><th className="border-b border-black/10 px-3 py-2.5 font-medium">Method</th><th className="border-b border-black/10 px-3 py-2.5 font-medium">Eligibility</th><th className="border-b border-black/10 px-3 py-2.5 font-medium">Type</th><th className="border-b border-black/10 px-3 py-2.5 text-right font-medium">Used</th></tr></thead><tbody>{visibleDiscounts.map((discount) => <tr key={discount.id} className={selectedIds.includes(discount.id) ? "bg-black/[0.025]" : "transition hover:bg-black/[0.02]"}><td className="border-b border-black/10 px-3 py-3"><input type="checkbox" checked={selectedIds.includes(discount.id)} onChange={() => toggleDiscount(discount.id)} aria-label={`Select ${discount.title}`} className="size-4 accent-black" /></td><td className="border-b border-black/10 px-3 py-3"><Link href={`/dashboard/discounts/${discount.id}`} className="block hover:underline"><p className="text-sm font-semibold text-[#0c3152]">{discount.title}</p><p className="mt-1 text-xs text-black/60">{summary(discount)}</p></Link></td><td className="border-b border-black/10 px-3 py-3"><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${discount.status === "ACTIVE" ? "bg-emerald-100 text-emerald-900" : "bg-black/[0.07] text-black/60"}`}>{discount.status === "ACTIVE" ? "Active" : "Inactive"}</span></td><td className="border-b border-black/10 px-3 py-3">{discount.method === "CODE" ? discount.code ?? "Code" : "Automatic"}</td><td className="border-b border-black/10 px-3 py-3">All customers</td><td className="border-b border-black/10 px-3 py-3">{typeLabel(discount.type)}</td><td className="border-b border-black/10 px-3 py-3 text-right">{discount.usageCount}</td></tr>)}</tbody></table></div>{!visibleDiscounts.length ? <div className="px-6 py-16 text-center"><BadgePercent className="mx-auto size-7 text-black/35" /><p className="mt-3 text-sm font-semibold">{discounts.length ? "No discounts match your search." : "No discounts yet."}</p><p className="mt-1 text-xs text-black/55">Create a discount code or automatic offer to start promoting your catalog.</p>{!discounts.length ? <CreateDiscountDialog /> : null}</div> : null}</section></div><AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete selected discounts?</AlertDialogTitle><AlertDialogDescription>This permanently removes the selected offers and their settings. This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isPending}>Keep discounts</AlertDialogCancel><AlertDialogAction disabled={isPending} onClick={() => { setDeleteOpen(false); deleteSelected() }} className="bg-red-600 text-white hover:bg-red-700">{isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}Delete discounts</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></main>
}
