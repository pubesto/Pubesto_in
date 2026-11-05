"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Download, FilePlus2, LoaderCircle, Mail, Search, ShoppingBag, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import {
  convertDraftOrdersAction,
  deleteDraftOrdersAction,
  sendDraftOrdersAction,
} from "@/app/actions/drafts"
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
import type { AdminDraftListItem } from "@/lib/server/dal/drafts"

type DraftFilter = "ALL" | AdminDraftListItem["status"]

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value))
}

function quoteCsv(value: string | number) {
  const stringValue = String(value)
  return /[",\n]/.test(stringValue) ? `"${stringValue.replaceAll('"', '""')}"` : stringValue
}

function DraftBadge({ status }: { status: AdminDraftListItem["status"] }) {
  const styles = status === "DRAFT" ? "bg-black/[0.07] text-black/65" : status === "SENT" ? "bg-sky-100 text-sky-900" : "bg-emerald-100 text-emerald-900"
  const label = status === "DRAFT" ? "Draft" : status === "SENT" ? "Sent" : "Completed"
  return <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${styles}`}>{label}</span>
}

export function DraftManager({ drafts }: { drafts: AdminDraftListItem[] }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<DraftFilter>("ALL")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const normalizedQuery = query.trim().toLowerCase()

  const visibleDrafts = useMemo(
    () => drafts.filter((draft) => {
      const matches = !normalizedQuery || [String(draft.number), draft.customer?.name ?? "", draft.email, draft.status].some((value) => value.toLowerCase().includes(normalizedQuery))
      return matches && (filter === "ALL" || draft.status === filter)
    }),
    [drafts, filter, normalizedQuery],
  )
  const allSelected = visibleDrafts.length > 0 && visibleDrafts.every((draft) => selectedIds.includes(draft.id))

  const toggleAll = () => {
    const ids = visibleDrafts.map((draft) => draft.id)
    setSelectedIds((current) => allSelected ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])])
  }
  const toggleDraft = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((currentId) => currentId !== id) : [...current, id])

  const runAction = (
    label: string,
    mutation: (ids: string[]) => Promise<{ success: boolean; count?: number; message?: string }>,
  ) => {
    const ids = selectedIds
    if (!ids.length) return
    startTransition(async () => {
      const result = await mutation(ids)
      if (!result.success) {
        toast.error(result.message)
        return
      }
      setSelectedIds([])
      toast.success(`${label} ${result.count} ${result.count === 1 ? "draft order" : "draft orders"}.`)
      router.refresh()
    })
  }

  const exportDrafts = () => {
    const headers = ["Draft", "Created", "Customer", "Email", "Status", "Items", "Total"]
    const rows = visibleDrafts.map((draft) => [`#${draft.number}`, formatDate(draft.createdAt), draft.customer?.name ?? "Guest", draft.email, draft.status, draft.itemCount, money(draft.total, draft.currency)].map(quoteCsv).join(","))
    const url = URL.createObjectURL(new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "pubesto-draft-orders.csv"
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${visibleDrafts.length} draft orders.`)
  }

  return (
    <main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-5">
      <div className="w-full">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="flex items-center gap-2 text-lg font-semibold"><FilePlus2 className="size-4" /> Drafts</h1><p className="mt-1 text-xs text-black/55">Create invoices, share them with customers, and convert them into orders.</p></div>
          <div className="flex items-center gap-2"><button type="button" onClick={exportDrafts} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black/[0.06] px-3 text-xs font-medium transition hover:bg-black/10"><Download className="size-3.5" /> Export</button><Link href="/dashboard/orders/drafts/new" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-3 text-xs font-medium text-white transition hover:bg-black/80"><ShoppingBag className="size-3.5" /> Create draft order</Link></div>
        </header>

        <section className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-black/10 px-4 py-3"><label className="flex min-w-52 flex-1 items-center gap-2 text-sm text-black/50"><Search className="size-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search draft orders" aria-label="Search draft orders" className="w-full bg-transparent outline-none placeholder:text-black/45" /></label><Select value={filter} onValueChange={(value) => setFilter(value as DraftFilter)}><SelectTrigger aria-label="Filter draft orders by status" className="h-8 w-36 rounded-md border-black/15 bg-white px-2 text-xs font-medium shadow-none"><SelectValue /></SelectTrigger><SelectContent position="popper"><SelectItem value="ALL">All drafts</SelectItem><SelectItem value="DRAFT">Draft</SelectItem><SelectItem value="SENT">Sent</SelectItem><SelectItem value="COMPLETED">Completed</SelectItem></SelectContent></Select><span className="text-xs text-black/45">{visibleDrafts.length} {visibleDrafts.length === 1 ? "draft" : "drafts"}</span></div>
          {selectedIds.length ? <div className="flex flex-wrap items-center gap-2 border-b border-black/10 bg-black/[0.02] px-3 py-2"><button type="button" onClick={() => setSelectedIds([])} aria-label="Clear draft selection" className="grid size-7 place-items-center rounded-md text-black/55 transition hover:bg-black/[0.06]"><X className="size-4" /></button><span className="text-xs font-semibold">{selectedIds.length} selected</span><button type="button" disabled={isPending} onClick={() => runAction("Sent", sendDraftOrdersAction)} className="inline-flex h-7 items-center gap-1 rounded-md border border-black/15 bg-white px-2.5 text-xs font-medium transition hover:bg-black/[0.04] disabled:opacity-50"><Mail className="size-3" /> Mark sent</button><button type="button" disabled={isPending} onClick={() => runAction("Created orders from", convertDraftOrdersAction)} className="h-7 rounded-md border border-black/15 bg-white px-2.5 text-xs font-medium transition hover:bg-black/[0.04] disabled:opacity-50">Create orders</button><button type="button" disabled={isPending} onClick={() => setDeleteOpen(true)} className="inline-flex h-7 items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"><Trash2 className="size-3" /> Delete</button></div> : null}
          <div className="overflow-x-auto"><table className="w-full min-w-[850px] border-collapse text-left text-xs"><thead className="bg-black/[0.025] text-black/65"><tr><th className="w-12 border-b border-black/10 px-3 py-2.5"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all visible draft orders" className="size-4 accent-black" /></th><th className="border-b border-black/10 px-3 py-2.5 font-medium">Draft</th><th className="border-b border-black/10 px-3 py-2.5 font-medium">Created</th><th className="border-b border-black/10 px-3 py-2.5 font-medium">Customer</th><th className="border-b border-black/10 px-3 py-2.5 font-medium">Status</th><th className="border-b border-black/10 px-3 py-2.5 text-right font-medium">Items</th><th className="border-b border-black/10 px-3 py-2.5 text-right font-medium">Total</th></tr></thead><tbody>{visibleDrafts.map((draft) => <tr key={draft.id} className={selectedIds.includes(draft.id) ? "bg-black/[0.025]" : "transition hover:bg-black/[0.02]"}><td className="border-b border-black/10 px-3 py-3"><input type="checkbox" checked={selectedIds.includes(draft.id)} onChange={() => toggleDraft(draft.id)} aria-label={`Select draft order ${draft.number}`} className="size-4 accent-black" /></td><td className="border-b border-black/10 px-3 py-3 font-medium">#{draft.number}</td><td className="border-b border-black/10 px-3 py-3 text-black/65">{formatDate(draft.createdAt)}</td><td className="border-b border-black/10 px-3 py-3"><span className="block font-medium">{draft.customer?.name ?? "Guest"}</span><span className="mt-1 block text-[11px] text-black/50">{draft.email}</span></td><td className="border-b border-black/10 px-3 py-3"><DraftBadge status={draft.status} /></td><td className="border-b border-black/10 px-3 py-3 text-right text-black/65">{draft.itemCount} {draft.itemCount === 1 ? "item" : "items"}</td><td className="border-b border-black/10 px-3 py-3 text-right font-medium">{money(draft.total, draft.currency)}</td></tr>)}</tbody></table></div>
          {!visibleDrafts.length ? <div className="px-6 py-16 text-center"><FilePlus2 className="mx-auto size-7 text-black/35" /><p className="mt-3 text-sm font-semibold">{drafts.length ? "No draft orders match your search." : "No draft orders yet."}</p><p className="mt-1 text-xs text-black/55">Create a draft to prepare an order or invoice for a customer.</p>{!drafts.length ? <Link href="/dashboard/orders/drafts/new" className="mt-4 inline-flex h-8 items-center rounded-lg bg-black px-3 text-xs font-medium text-white transition hover:bg-black/80">Create draft order</Link> : null}</div> : null}
        </section>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete selected draft orders?</AlertDialogTitle><AlertDialogDescription>Drafts marked as sent or still in progress will be permanently deleted. Completed drafts will be kept.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isPending}>Keep drafts</AlertDialogCancel><AlertDialogAction disabled={isPending} onClick={() => { setDeleteOpen(false); runAction("Deleted", deleteDraftOrdersAction) }} className="bg-red-600 text-white hover:bg-red-700">{isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}Delete drafts</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </main>
  )
}
