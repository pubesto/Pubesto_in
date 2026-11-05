"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Download, LoaderCircle, Search, ShoppingCart, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import {
  clearAbandonedCheckoutsAction,
  recoverAbandonedCheckoutsAction,
} from "@/app/actions/abandoned-checkouts"
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
import type { AdminAbandonedCheckout } from "@/lib/server/dal/abandoned-checkouts"

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value))
}

function checkoutNumber(id: string) {
  return `#${id.slice(-10).toUpperCase()}`
}

function quoteCsv(value: string | number) {
  const stringValue = String(value)
  return /[",\n]/.test(stringValue) ? `"${stringValue.replaceAll('"', '""')}"` : stringValue
}

export function AbandonedCheckoutManager({ checkouts }: { checkouts: AdminAbandonedCheckout[] }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [clearOpen, setClearOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const normalizedQuery = query.trim().toLowerCase()
  const visibleCheckouts = useMemo(
    () => checkouts.filter((checkout) => !normalizedQuery || [checkout.id, checkout.customer.name, checkout.customer.email].some((value) => value.toLowerCase().includes(normalizedQuery))),
    [checkouts, normalizedQuery],
  )
  const allSelected = visibleCheckouts.length > 0 && visibleCheckouts.every((checkout) => selectedIds.includes(checkout.id))

  const toggleAll = () => {
    const ids = visibleCheckouts.map((checkout) => checkout.id)
    setSelectedIds((current) => allSelected ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])])
  }
  const toggleCheckout = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((currentId) => currentId !== id) : [...current, id])

  const recover = () => {
    const ids = selectedIds
    if (!ids.length) return
    startTransition(async () => {
      const result = await recoverAbandonedCheckoutsAction(ids)
      if (!result.success) {
        toast.error(result.message)
        return
      }
      setSelectedIds([])
      toast.success(`Created ${result.count} ${result.count === 1 ? "pending order" : "pending orders"} from the selected checkouts.`)
      router.refresh()
    })
  }

  const clear = () => {
    const ids = selectedIds
    if (!ids.length) return
    startTransition(async () => {
      const result = await clearAbandonedCheckoutsAction(ids)
      if (!result.success) {
        toast.error(result.message)
        return
      }
      setSelectedIds([])
      toast.success(`Cleared ${result.count} ${result.count === 1 ? "checkout" : "checkouts"}.`)
      router.refresh()
    })
  }

  const exportCheckouts = () => {
    const headers = ["Checkout", "Created", "Customer", "Email", "Items", "Recovery status", "Total"]
    const rows = visibleCheckouts.map((checkout) => [checkoutNumber(checkout.id), formatDate(checkout.createdAt), checkout.customer.name, checkout.customer.email, checkout.itemCount, "Open", money(checkout.total, checkout.currency)].map(quoteCsv).join(","))
    const url = URL.createObjectURL(new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "pubesto-abandoned-checkouts.csv"
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${visibleCheckouts.length} abandoned checkouts.`)
  }

  return (
    <main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-5">
      <div className="w-full">
        <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-lg font-semibold"><ShoppingCart className="size-4" /> Abandoned checkouts</h1><p className="mt-1 text-xs text-black/55">Review active carts that still contain products, then turn them into pending orders or clear them.</p></div><button type="button" onClick={exportCheckouts} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-3 text-xs font-medium text-white transition hover:bg-black/80"><Download className="size-3.5" /> Export</button></header>
        <section className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm"><div className="flex flex-wrap items-center gap-3 border-b border-black/10 px-4 py-3"><label className="flex min-w-52 flex-1 items-center gap-2 text-sm text-black/50"><Search className="size-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search abandoned checkouts" placeholder="Search checkout, customer, or email" className="w-full bg-transparent outline-none placeholder:text-black/45" /></label><span className="text-xs text-black/45">{visibleCheckouts.length} {visibleCheckouts.length === 1 ? "checkout" : "checkouts"}</span></div>
          {selectedIds.length ? <div className="flex flex-wrap items-center gap-2 border-b border-black/10 bg-black/[0.02] px-3 py-2"><button type="button" onClick={() => setSelectedIds([])} aria-label="Clear checkout selection" className="grid size-7 place-items-center rounded-md text-black/55 transition hover:bg-black/[0.06]"><X className="size-4" /></button><span className="text-xs font-semibold">{selectedIds.length} selected</span><button type="button" disabled={isPending} onClick={recover} className="h-7 rounded-md border border-black/15 bg-white px-2.5 text-xs font-medium transition hover:bg-black/[0.04] disabled:opacity-50">Create pending order</button><button type="button" disabled={isPending} onClick={() => setClearOpen(true)} className="inline-flex h-7 items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"><Trash2 className="size-3" /> Clear cart</button></div> : null}
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] border-collapse text-left text-xs"><thead className="bg-black/[0.025] text-black/65"><tr><th className="w-12 border-b border-black/10 px-3 py-2.5"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all visible abandoned checkouts" className="size-4 accent-black" /></th><th className="border-b border-black/10 px-3 py-2.5 font-medium">Checkout</th><th className="border-b border-black/10 px-3 py-2.5 font-medium">Last updated</th><th className="border-b border-black/10 px-3 py-2.5 font-medium">Customer</th><th className="border-b border-black/10 px-3 py-2.5 text-right font-medium">Items</th><th className="border-b border-black/10 px-3 py-2.5 font-medium">Recovery status</th><th className="border-b border-black/10 px-3 py-2.5 text-right font-medium">Total price</th></tr></thead><tbody>{visibleCheckouts.map((checkout) => <tr key={checkout.id} className={selectedIds.includes(checkout.id) ? "bg-black/[0.025]" : "transition hover:bg-black/[0.02]"}><td className="border-b border-black/10 px-3 py-3"><input type="checkbox" checked={selectedIds.includes(checkout.id)} onChange={() => toggleCheckout(checkout.id)} aria-label={`Select checkout ${checkoutNumber(checkout.id)}`} className="size-4 accent-black" /></td><td className="border-b border-black/10 px-3 py-3 font-medium"><Link href={`/dashboard/orders/abandoned-checkouts/${checkout.id}`} className="text-[#0c3152] hover:underline">{checkoutNumber(checkout.id)}</Link></td><td className="border-b border-black/10 px-3 py-3 text-black/65">{formatDate(checkout.createdAt)}</td><td className="border-b border-black/10 px-3 py-3"><span className="block font-medium">{checkout.customer.name}</span><span className="mt-1 block text-[11px] text-black/50">{checkout.customer.email}</span></td><td className="border-b border-black/10 px-3 py-3 text-right text-black/65">{checkout.itemCount}</td><td className="border-b border-black/10 px-3 py-3"><span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-900">Open</span></td><td className="border-b border-black/10 px-3 py-3 text-right font-medium">{money(checkout.total, checkout.currency)}</td></tr>)}</tbody></table></div>
          {!visibleCheckouts.length ? <div className="px-6 py-16 text-center"><ShoppingCart className="mx-auto size-7 text-black/35" /><p className="mt-3 text-sm font-semibold">{checkouts.length ? "No abandoned checkouts match your search." : "No abandoned checkouts right now."}</p><p className="mt-1 text-xs text-black/55">Carts with products appear here until they are cleared or converted into orders.</p></div> : null}
        </section>
      </div>
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Clear selected carts?</AlertDialogTitle><AlertDialogDescription>This permanently removes the products from these customer carts. The carts will no longer appear as abandoned checkouts.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isPending}>Keep carts</AlertDialogCancel><AlertDialogAction disabled={isPending} onClick={() => { setClearOpen(false); clear() }} className="bg-red-600 text-white hover:bg-red-700">{isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}Clear carts</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </main>
  )
}
