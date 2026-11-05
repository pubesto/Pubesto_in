"use client"

import Link from "next/link"
import { useMemo, useRef, useState, useTransition, type ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Grid2X2,
  List,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react"
import { toast } from "sonner"

import {
  createCustomerAction,
  deleteCustomersAction,
  importCustomersAction,
} from "@/app/actions/customers"
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { AdminCustomerListItem } from "@/lib/server/dal/customers"

type SubscriptionFilter = "ALL" | "SUBSCRIBED" | "NOT_SUBSCRIBED"
type View = "TABLE" | "GRID"

const pageSize = 50

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function quoteCsv(value: string | number) {
  const stringValue = String(value)
  return /[",\n]/.test(stringValue)
    ? `"${stringValue.replaceAll('"', '""')}"`
    : stringValue
}

function parseCsv(source: string) {
  const rows: string[][] = []
  let row: string[] = []
  let value = ""
  let quoted = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        value += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }
    if (character === "," && !quoted) {
      row.push(value)
      value = ""
      continue
    }
    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1
      row.push(value)
      if (row.some((entry) => entry.trim())) rows.push(row)
      row = []
      value = ""
      continue
    }
    value += character
  }

  row.push(value)
  if (row.some((entry) => entry.trim())) rows.push(row)
  if (rows.length < 2) return []

  const headers = rows[0].map((header) =>
    header.trim().toLowerCase().replace(/[^a-z0-9]/g, ""),
  )
  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""])),
  )
}

function subscriptionLabel(subscribed: boolean) {
  return subscribed ? "Subscribed" : "Not subscribed"
}

function filterLabel(filter: SubscriptionFilter) {
  if (filter === "SUBSCRIBED") return "Subscribed"
  if (filter === "NOT_SUBSCRIBED") return "Not subscribed"
  return "All customers"
}

function CustomerAvatar({ name }: { name: string }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#0c3152] text-[11px] font-semibold text-white">
      {name.slice(0, 2).toUpperCase()}
    </span>
  )
}

function SubscriptionBadge({ subscribed }: { subscribed: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
        subscribed
          ? "bg-emerald-100 text-emerald-900"
          : "bg-black/[0.06] text-black/60"
      }`}
    >
      {subscriptionLabel(subscribed)}
    </span>
  )
}

export function CustomerManager({
  initialCustomers,
}: {
  initialCustomers: AdminCustomerListItem[]
}) {
  const router = useRouter()
  const importInputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<SubscriptionFilter>("ALL")
  const [view, setView] = useState<View>("TABLE")
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [customersToDelete, setCustomersToDelete] = useState<string[] | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [emailMarketingSubscribed, setEmailMarketingSubscribed] = useState(false)
  const [isPending, startTransition] = useTransition()

  const normalizedQuery = query.trim().toLowerCase()
  const filteredCustomers = useMemo(
    () =>
      initialCustomers.filter((customer) => {
        const matchesQuery =
          !normalizedQuery ||
          [customer.name, customer.email, customer.location].some((value) =>
            value.toLowerCase().includes(normalizedQuery),
          )
        const matchesFilter =
          filter === "ALL" ||
          (filter === "SUBSCRIBED" && customer.emailMarketingSubscribed) ||
          (filter === "NOT_SUBSCRIBED" && !customer.emailMarketingSubscribed)

        return matchesQuery && matchesFilter
      }),
    [filter, initialCustomers, normalizedQuery],
  )
  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize))
  const visiblePage = Math.min(page, totalPages)
  const startIndex = (visiblePage - 1) * pageSize
  const pageCustomers = filteredCustomers.slice(startIndex, startIndex + pageSize)
  const selectedPageCount = pageCustomers.filter((customer) =>
    selectedIds.includes(customer.id),
  ).length
  const allPageSelected =
    pageCustomers.length > 0 && selectedPageCount === pageCustomers.length

  const updateFilter = (value: SubscriptionFilter) => {
    setFilter(value)
    setPage(1)
  }

  const toggleCustomer = (customerId: string) => {
    setSelectedIds((current) =>
      current.includes(customerId)
        ? current.filter((id) => id !== customerId)
        : [...current, customerId],
    )
  }

  const togglePageSelection = () => {
    const pageIds = pageCustomers.map((customer) => customer.id)
    setSelectedIds((current) =>
      allPageSelected
        ? current.filter((id) => !pageIds.includes(id))
        : [...new Set([...current, ...pageIds])],
    )
  }

  const resetCreateForm = () => {
    setName("")
    setEmail("")
    setEmailMarketingSubscribed(false)
  }

  const createCustomer = () => {
    startTransition(async () => {
      const result = await createCustomerAction({
        name,
        email,
        emailMarketingSubscribed,
      })
      if (!result.success) {
        toast.error(result.message)
        return
      }

      resetCreateForm()
      setCreateOpen(false)
      toast.success("Customer created.")
      router.push(`/dashboard/customers/${result.customerId}`)
      router.refresh()
    })
  }

  const deleteSelectedCustomers = () => {
    if (!customersToDelete?.length) return
    const ids = customersToDelete

    startTransition(async () => {
      const result = await deleteCustomersAction(ids)
      if (!result.success) {
        toast.error(result.message)
        return
      }

      setCustomersToDelete(null)
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)))
      toast.success(
        result.count === 1 ? "Customer deleted." : `${result.count} customers deleted.`,
      )
      router.refresh()
    })
  }

  const exportCustomers = () => {
    const headers = [
      "Name",
      "Email",
      "Email subscription",
      "Location",
      "Orders",
      "Amount spent",
    ]
    const lines = filteredCustomers.map((customer) =>
      [
        customer.name,
        customer.email,
        subscriptionLabel(customer.emailMarketingSubscribed),
        customer.location,
        customer.orderCount,
        money(customer.amountSpent, customer.currency),
      ]
        .map(quoteCsv)
        .join(","),
    )
    const blob = new Blob([[headers.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "pubesto-customers.csv"
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filteredCustomers.length} customers.`)
  }

  const importCustomers = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Choose a CSV smaller than 2 MB.")
      return
    }

    const rows = parseCsv(await file.text())
    if (!rows.length) {
      toast.error("The CSV needs a header row and at least one customer.")
      return
    }
    if (rows.length > 500) {
      toast.error("Import up to 500 customers at a time.")
      return
    }

    const customers: Array<{
      name: string
      email: string
      emailMarketingSubscribed: boolean
    }> = []
    for (const [index, row] of rows.entries()) {
      const customerName = row.name || row.customername || row.fullname
      const customerEmail = row.email?.toLowerCase()
      if (!customerName || !customerEmail) {
        toast.error(`Row ${index + 2} needs a customer name and email address.`)
        return
      }
      const subscription = (row.emailsubscription || row.emailmarketingsubscribed || "")
        .trim()
        .toLowerCase()
      customers.push({
        name: customerName,
        email: customerEmail,
        emailMarketingSubscribed: ["subscribed", "yes", "true", "1"].includes(subscription),
      })
    }

    startTransition(async () => {
      const result = await importCustomersAction(customers)
      if (!result.success) {
        toast.error(result.message)
        return
      }

      toast.success(`Imported ${result.count} ${result.count === 1 ? "customer" : "customers"}.`)
      router.refresh()
    })
  }

  return (
    <main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-5">
      <div className="w-full">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <UserRound className="size-4" />
              Customers
            </h1>
            <p className="mt-1 text-xs text-black/55">
              Manage customer profiles, marketing consent, and purchase history.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={exportCustomers} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black/[0.06] px-3 text-xs font-medium transition hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"><Download className="size-3.5" /> Export</button>
            <button type="button" disabled={isPending} onClick={() => importInputRef.current?.click()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black/[0.06] px-3 text-xs font-medium transition hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:cursor-not-allowed disabled:opacity-60"><Upload className="size-3.5" /> Import</button>
            <input ref={importInputRef} type="file" accept=".csv,text/csv" onChange={importCustomers} className="sr-only" />
            <button type="button" disabled={isPending} onClick={() => setCreateOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-3 text-xs font-medium text-white transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-black/50"><Plus className="size-3.5" /> Add customer</button>
          </div>
        </header>

        <section className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-black/10 px-4 py-3">
            <Popover>
              <PopoverTrigger asChild><button type="button" className="inline-flex h-8 items-center gap-1 rounded-md px-1.5 text-xs font-medium transition hover:bg-black/[0.05]">{filterLabel(filter)} <ChevronDown className="size-3.5" /></button></PopoverTrigger>
              <PopoverContent align="start" className="w-44 gap-1 p-1.5">{(["ALL", "SUBSCRIBED", "NOT_SUBSCRIBED"] as SubscriptionFilter[]).map((value) => <button key={value} type="button" onClick={() => updateFilter(value)} className={`flex h-8 w-full items-center rounded-md px-2 text-left text-sm transition ${filter === value ? "bg-black/[0.06] font-medium" : "hover:bg-black/[0.04]"}`}>{filterLabel(value)}</button>)}</PopoverContent>
            </Popover>
            <label className="flex min-w-52 flex-1 items-center gap-2 text-sm text-black/50"><Search className="size-4" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} aria-label="Search customers" placeholder="Search customers" className="w-full bg-transparent outline-none placeholder:text-black/45" /></label>
            <span className="text-xs text-black/45">{filteredCustomers.length} {filteredCustomers.length === 1 ? "customer" : "customers"}</span>
            <div className="inline-flex rounded-md border border-black/10 p-0.5"><button type="button" onClick={() => setView("TABLE")} aria-label="Table view" aria-pressed={view === "TABLE"} className={`grid size-7 place-items-center rounded transition ${view === "TABLE" ? "bg-black/[0.08] text-black" : "text-black/50 hover:bg-black/[0.04]"}`}><List className="size-3.5" /></button><button type="button" onClick={() => setView("GRID")} aria-label="Grid view" aria-pressed={view === "GRID"} className={`grid size-7 place-items-center rounded transition ${view === "GRID" ? "bg-black/[0.08] text-black" : "text-black/50 hover:bg-black/[0.04]"}`}><Grid2X2 className="size-3.5" /></button></div>
          </div>

          {selectedIds.length ? <div className="flex items-center gap-2 border-b border-black/10 bg-black/[0.02] px-3 py-2"><button type="button" onClick={() => setSelectedIds([])} aria-label="Clear customer selection" className="grid size-7 place-items-center rounded-md text-black/55 transition hover:bg-black/[0.06]"><X className="size-4" /></button><span className="text-xs font-semibold">{selectedIds.length} selected</span><button type="button" disabled={isPending} onClick={() => setCustomersToDelete(selectedIds)} className="ml-1 inline-flex h-7 items-center gap-1.5 rounded-md border border-red-200 bg-white px-2.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"><Trash2 className="size-3.5" /> Delete</button></div> : null}

          {view === "TABLE" ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[930px] border-collapse text-left text-xs">
                <thead className="bg-black/[0.025] text-black/65"><tr><th className="w-12 border-b border-black/10 px-3 py-2.5 font-medium"><input type="checkbox" checked={allPageSelected} onChange={togglePageSelection} aria-label="Select customers on this page" className="size-4 accent-black" /></th><th className="border-b border-black/10 px-3 py-2.5 font-medium">Customer name</th><th className="border-b border-black/10 px-3 py-2.5 font-medium">Email subscription</th><th className="border-b border-black/10 px-3 py-2.5 font-medium">Location</th><th className="border-b border-black/10 px-3 py-2.5 text-right font-medium">Orders</th><th className="border-b border-black/10 px-3 py-2.5 text-right font-medium">Amount spent</th><th className="w-16 border-b border-black/10 px-3 py-2.5 font-medium" /></tr></thead>
                <tbody>{pageCustomers.map((customer) => <tr key={customer.id} className={selectedIds.includes(customer.id) ? "bg-black/[0.025]" : "transition hover:bg-black/[0.02]"}><td className="border-b border-black/10 px-3 py-2.5"><input type="checkbox" checked={selectedIds.includes(customer.id)} onChange={() => toggleCustomer(customer.id)} aria-label={`Select ${customer.name}`} className="size-4 accent-black" /></td><td className="border-b border-black/10 px-3 py-2.5"><Link href={`/dashboard/customers/${customer.id}`} className="flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-black"><CustomerAvatar name={customer.name} /><span className="min-w-0"><span className="block truncate font-medium text-[#0c3152] hover:underline">{customer.name}</span><span className="mt-1 block truncate text-[11px] text-black/50">{customer.email}</span></span></Link></td><td className="border-b border-black/10 px-3 py-2.5"><SubscriptionBadge subscribed={customer.emailMarketingSubscribed} /></td><td className="border-b border-black/10 px-3 py-2.5 text-black/65">{customer.location}</td><td className="border-b border-black/10 px-3 py-2.5 text-right text-black/65">{customer.orderCount}</td><td className="border-b border-black/10 px-3 py-2.5 text-right font-medium">{money(customer.amountSpent, customer.currency)}</td><td className="border-b border-black/10 px-3 py-2.5"><button type="button" disabled={isPending} onClick={() => setCustomersToDelete([customer.id])} aria-label={`Delete ${customer.name}`} className="grid size-7 place-items-center rounded-md text-black/50 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"><Trash2 className="size-3.5" /></button></td></tr>)}</tbody>
              </table>
            </div>
          ) : <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{pageCustomers.map((customer) => <article key={customer.id} className={`rounded-lg border p-4 transition ${selectedIds.includes(customer.id) ? "border-black/35 bg-black/[0.025]" : "border-black/10 hover:border-black/25"}`}><div className="flex items-start gap-3"><input type="checkbox" checked={selectedIds.includes(customer.id)} onChange={() => toggleCustomer(customer.id)} aria-label={`Select ${customer.name}`} className="mt-2 size-4 accent-black" /><CustomerAvatar name={customer.name} /><div className="min-w-0 flex-1"><Link href={`/dashboard/customers/${customer.id}`} className="block truncate text-sm font-semibold text-[#0c3152] hover:underline">{customer.name}</Link><p className="mt-1 truncate text-xs text-black/55">{customer.email}</p></div></div><div className="mt-4 flex items-center justify-between gap-3"><SubscriptionBadge subscribed={customer.emailMarketingSubscribed} /><button type="button" disabled={isPending} onClick={() => setCustomersToDelete([customer.id])} aria-label={`Delete ${customer.name}`} className="grid size-7 place-items-center rounded-md text-black/50 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"><Trash2 className="size-3.5" /></button></div><dl className="mt-4 grid grid-cols-2 gap-3 border-t border-black/10 pt-3 text-xs"><div><dt className="text-black/50">Orders</dt><dd className="mt-1 font-semibold">{customer.orderCount}</dd></div><div><dt className="text-black/50">Amount spent</dt><dd className="mt-1 font-semibold">{money(customer.amountSpent, customer.currency)}</dd></div></dl><p className="mt-3 truncate text-xs text-black/55">{customer.location}</p></article>)}</div>}

          {!pageCustomers.length ? <div className="px-4 py-12 text-center"><p className="text-sm font-medium">No customers match your search.</p><p className="mt-1 text-xs text-black/55">Try a different term or create a new customer.</p></div> : null}
          {pageCustomers.length ? <div className="flex items-center justify-between border-t border-black/10 px-3 py-2 text-xs text-black/60"><span>{startIndex + 1}–{Math.min(startIndex + pageSize, filteredCustomers.length)} of {filteredCustomers.length}</span><div className="flex items-center gap-1"><button type="button" disabled={visiblePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous page" className="grid size-7 place-items-center rounded-md bg-black/5 transition hover:bg-black/10 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="size-4" /></button><button type="button" disabled={visiblePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} aria-label="Next page" className="grid size-7 place-items-center rounded-md bg-black/5 transition hover:bg-black/10 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight className="size-4" /></button></div></div> : null}
        </section>
      </div>

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetCreateForm() }}>
        <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:!w-[480px] sm:!max-w-[480px]" overlayClassName="bg-black/45 supports-backdrop-filter:backdrop-blur-[1px]">
          <DialogHeader className="border-b border-black/10 px-5 py-4"><DialogTitle>Add customer</DialogTitle><DialogDescription>Create a customer profile. They can activate an account later through the storefront.</DialogDescription></DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); createCustomer() }}><div className="space-y-4 px-5 py-4"><label className="grid gap-1.5 text-sm font-medium" htmlFor="customer-name">Name<input id="customer-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className="h-10 rounded-lg border border-black/25 bg-white px-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10" /></label><label className="grid gap-1.5 text-sm font-medium" htmlFor="customer-email">Email<input id="customer-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" className="h-10 rounded-lg border border-black/25 bg-white px-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10" /></label><label className="flex items-start gap-2 text-sm text-black/70"><input type="checkbox" checked={emailMarketingSubscribed} onChange={(event) => setEmailMarketingSubscribed(event.target.checked)} className="mt-0.5 size-4 accent-black" />Subscribe this customer to email marketing</label></div><DialogFooter className="flex-row justify-end border-t border-black/10 px-5 py-3"><button type="button" disabled={isPending} onClick={() => setCreateOpen(false)} className="h-9 rounded-lg border border-black/15 px-3 text-sm font-medium transition hover:bg-black/[0.03] disabled:opacity-50">Cancel</button><button type="submit" disabled={isPending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-3 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/30">{isPending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}Create customer</button></DialogFooter></form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(customersToDelete?.length)} onOpenChange={(open) => { if (!open) setCustomersToDelete(null) }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {customersToDelete?.length === 1 ? "customer" : "customers"}?</AlertDialogTitle><AlertDialogDescription>The customer profile will be removed. Existing orders will be kept for reporting, but will no longer be connected to this profile.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel><AlertDialogAction disabled={isPending} onClick={deleteSelectedCustomers} className="bg-red-600 text-white hover:bg-red-700">{isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
