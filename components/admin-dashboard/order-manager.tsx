"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  LoaderCircle,
  MoreHorizontal,
  Package,
  Search,
  X,
} from "lucide-react"
import { toast } from "sonner"

import {
  cancelOrdersAction,
  fulfillOrdersAction,
  markOrdersPaidAction,
} from "@/app/actions/orders"
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type {
  AdminOrderDashboard,
  AdminOrderListItem,
} from "@/lib/server/dal/orders"

type OrderFilter = "ALL" | "PENDING" | "CONFIRMED" | "FULFILLED" | "CANCELLED"

const pageSize = 50

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function quoteCsv(value: string | number) {
  const stringValue = String(value)
  return /[",\n]/.test(stringValue)
    ? `"${stringValue.replaceAll('"', '""')}"`
    : stringValue
}

function filterLabel(filter: OrderFilter) {
  if (filter === "PENDING") return "Payment pending"
  if (filter === "CONFIRMED") return "Paid · Unfulfilled"
  if (filter === "FULFILLED") return "Fulfilled"
  if (filter === "CANCELLED") return "Cancelled"
  return "All orders"
}

function paymentLabel(order: Pick<AdminOrderListItem, "status" | "paymentStatus" | "paymentMethod">) {
  if (order.paymentStatus === "REFUNDED") return "Refunded"
  if (order.status === "CANCELLED") return order.paymentStatus === "PAID" ? "Refund due" : "Voided"
  if (order.paymentStatus === "PAID") return "Paid"
  return order.paymentMethod === "COD" ? "COD · due" : "Payment pending"
}

function fulfillmentLabel(status: AdminOrderListItem["status"]) {
  if (status === "FULFILLED") return "Fulfilled"
  if (status === "CANCELLED") return "Cancelled"
  return "Unfulfilled"
}

function PaymentBadge({ order }: { order: Pick<AdminOrderListItem, "status" | "paymentStatus" | "paymentMethod"> }) {
  const label = paymentLabel(order)
  const status = label === "Paid" || label === "Refunded" ? "CONFIRMED" : label === "Voided" ? "CANCELLED" : "PENDING"
  const className =
    status === "PENDING"
      ? "bg-amber-100 text-amber-900"
      : status === "CANCELLED"
        ? "bg-black/[0.06] text-black/55"
        : "bg-emerald-100 text-emerald-900"

  return <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${className}`}>{label}</span>
}

function FulfillmentBadge({ status }: { status: AdminOrderListItem["status"] }) {
  const label = fulfillmentLabel(status)
  const className =
    status === "FULFILLED"
      ? "bg-emerald-100 text-emerald-900"
      : status === "CANCELLED"
        ? "bg-red-50 text-red-700"
        : "bg-amber-100 text-amber-900"

  return <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${className}`}>{label}</span>
}

export function OrderManager({ dashboard }: { dashboard: AdminOrderDashboard }) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<OrderFilter>("ALL")
  const [page, setPage] = useState(1)
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [cancelOpen, setCancelOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const normalizedQuery = query.trim().toLowerCase()

  const filteredOrders = useMemo(
    () =>
      dashboard.orders.filter((order) => {
        const customer = order.customer?.name ?? order.email
        const matchesQuery =
          !normalizedQuery ||
          [String(order.number), order.reference, customer, order.email, paymentLabel(order), fulfillmentLabel(order.status)].some(
            (value) => value.toLowerCase().includes(normalizedQuery),
          )
        return matchesQuery && (filter === "ALL" || order.status === filter)
      }),
    [dashboard.orders, filter, normalizedQuery],
  )
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize))
  const visiblePage = Math.min(page, totalPages)
  const startIndex = (visiblePage - 1) * pageSize
  const pageOrders = filteredOrders.slice(startIndex, startIndex + pageSize)
  const selectedPageCount = pageOrders.filter((order) => selectedOrderIds.includes(order.id)).length
  const allPageSelected = pageOrders.length > 0 && selectedPageCount === pageOrders.length

  const selectPage = () => {
    const pageIds = pageOrders.map((order) => order.id)
    setSelectedOrderIds((current) =>
      allPageSelected
        ? current.filter((id) => !pageIds.includes(id))
        : [...new Set([...current, ...pageIds])],
    )
  }

  const toggleOrder = (orderId: string) => {
    setSelectedOrderIds((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId],
    )
  }

  const runAction = (
    label: string,
    mutation: (ids: string[]) => Promise<{ success: boolean; count?: number; message?: string }>,
  ) => {
    if (!selectedOrderIds.length) return
    const ids = selectedOrderIds

    startTransition(async () => {
      const result = await mutation(ids)
      if (!result.success) {
        toast.error(result.message)
        return
      }

      setSelectedOrderIds([])
      toast.success(`${label} ${result.count} ${result.count === 1 ? "order" : "orders"}.`)
    })
  }

  const exportOrders = () => {
    const headers = [
      "Order",
      "Date",
      "Customer",
      "Email",
      "Total",
      "Payment status",
      "Fulfillment status",
      "Items",
    ]
    const lines = filteredOrders.map((order) =>
      [
        `#${order.number}`,
        formatDate(order.createdAt),
        order.customer?.name ?? "Guest",
        order.email,
        money(order.total, order.currency),
        paymentLabel(order),
        fulfillmentLabel(order.status),
        order.itemCount,
      ]
        .map(quoteCsv)
        .join(","),
    )
    const blob = new Blob([[headers.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "pubesto-orders.csv"
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filteredOrders.length} orders.`)
  }

  const metricCards = [
    ["Orders", dashboard.metrics.orderCount],
    ["Items ordered", dashboard.metrics.itemCount],
    ["Returns", money(dashboard.metrics.returnsAmount, "INR")],
    ["Orders fulfilled", dashboard.metrics.fulfilledCount],
    ["Orders delivered", dashboard.metrics.deliveredCount],
    ["Order to fulfillment time", "—"],
  ]

  return (
    <main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-5">
      <div className="w-full">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="flex items-center gap-2 text-lg font-semibold"><Package className="size-4" /> Orders</h1><p className="mt-1 text-xs text-black/55">Review payments, fulfil orders, and manage order activity.</p></div>
          <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={exportOrders} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black/[0.06] px-3 text-xs font-medium transition hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"><Download className="size-3.5" /> Export</button><Popover><PopoverTrigger asChild><button type="button" disabled={!selectedOrderIds.length || isPending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black/[0.06] px-3 text-xs font-medium transition hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:cursor-not-allowed disabled:opacity-50">More actions <ChevronDown className="size-3.5" /></button></PopoverTrigger><PopoverContent align="end" className="w-48 gap-1 p-1.5"><button type="button" onClick={() => runAction("Marked as paid:", markOrdersPaidAction)} className="flex h-8 w-full items-center rounded-md px-2 text-left text-sm transition hover:bg-black/[0.04]">Mark as paid</button><button type="button" onClick={() => runAction("Fulfilled:", fulfillOrdersAction)} className="flex h-8 w-full items-center rounded-md px-2 text-left text-sm transition hover:bg-black/[0.04]">Mark as fulfilled</button><button type="button" onClick={() => setCancelOpen(true)} className="flex h-8 w-full items-center rounded-md px-2 text-left text-sm text-red-700 transition hover:bg-red-50">Cancel orders</button></PopoverContent></Popover><Link href="/dashboard/orders/create-order" className="inline-flex h-9 items-center rounded-lg bg-black px-3 text-xs font-medium text-white transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">Create order</Link></div>
        </header>

        <section className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm"><div className="grid grid-cols-2 divide-x divide-y divide-black/10 sm:grid-cols-3 lg:grid-cols-7 lg:divide-y-0"><div className="flex items-center gap-2 px-4 py-4 text-xs font-medium"><CalendarDays className="size-4" /> Today</div>{metricCards.map(([label, value]) => <div key={String(label)} className="px-4 py-3"><p className="text-xs font-medium text-black/65">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p><div className="mt-2 h-0.5 w-11 bg-[#55c5f7]" /></div>)}</div></section>

        <section className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm"><div className="flex flex-wrap items-center gap-3 border-b border-black/10 px-4 py-3"><Popover><PopoverTrigger asChild><button type="button" className="inline-flex h-8 items-center gap-1 rounded-md px-1.5 text-xs font-medium transition hover:bg-black/[0.05]">{filterLabel(filter)} <ChevronDown className="size-3.5" /></button></PopoverTrigger><PopoverContent align="start" className="w-48 gap-1 p-1.5">{(["ALL", "PENDING", "CONFIRMED", "FULFILLED", "CANCELLED"] as OrderFilter[]).map((value) => <button key={value} type="button" onClick={() => { setFilter(value); setPage(1) }} className={`flex h-8 w-full items-center rounded-md px-2 text-left text-sm transition ${filter === value ? "bg-black/[0.06] font-medium" : "hover:bg-black/[0.04]"}`}>{filterLabel(value)}</button>)}</PopoverContent></Popover><label className="flex min-w-52 flex-1 items-center gap-2 text-sm text-black/50"><Search className="size-4" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} aria-label="Search and filter orders" placeholder="Search order, customer, or email" className="w-full bg-transparent outline-none placeholder:text-black/45" /></label><span className="text-xs text-black/45">{filteredOrders.length} {filteredOrders.length === 1 ? "order" : "orders"}</span><MoreHorizontal className="size-4 text-black/45" /></div>
          {selectedOrderIds.length ? <div className="flex items-center gap-2 border-b border-black/10 bg-black/[0.02] px-3 py-2"><button type="button" onClick={() => setSelectedOrderIds([])} aria-label="Clear order selection" className="grid size-7 place-items-center rounded-md text-black/55 transition hover:bg-black/[0.06]"><X className="size-4" /></button><span className="text-xs font-semibold">{selectedOrderIds.length} selected</span><button type="button" disabled={isPending} onClick={() => runAction("Marked as paid:", markOrdersPaidAction)} className="ml-1 h-7 rounded-md border border-black/15 bg-white px-2.5 text-xs font-medium transition hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50">Mark as paid</button><button type="button" disabled={isPending} onClick={() => runAction("Fulfilled:", fulfillOrdersAction)} className="h-7 rounded-md border border-black/15 bg-white px-2.5 text-xs font-medium transition hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50">Fulfill</button><Link href={`/dashboard/orders/${selectedOrderIds[0]}`} className="inline-flex h-7 items-center gap-1 rounded-md border border-black/15 bg-white px-2.5 text-xs font-medium transition hover:bg-black/[0.04]"><FileText className="size-3" /> View Invoice</Link></div> : null}
          <div className="overflow-x-auto"><table className="w-full min-w-[1080px] border-collapse text-left text-xs"><thead className="bg-black/[0.025] text-black/65"><tr><th className="w-12 border-b border-black/10 px-3 py-2.5 font-medium"><input type="checkbox" checked={allPageSelected} onChange={selectPage} aria-label="Select orders on this page" className="size-4 accent-black" /></th><th className="border-b border-black/10 px-3 py-2.5 font-medium">Order</th><th className="border-b border-black/10 px-3 py-2.5 font-medium">Date</th><th className="border-b border-black/10 px-3 py-2.5 font-medium">Customer</th><th className="border-b border-black/10 px-3 py-2.5 text-right font-medium">Total</th><th className="border-b border-black/10 px-3 py-2.5 font-medium">Payment status</th><th className="border-b border-black/10 px-3 py-2.5 font-medium">Fulfillment status</th><th className="border-b border-black/10 px-3 py-2.5 text-right font-medium">Items</th><th className="border-b border-black/10 px-3 py-2.5 text-center font-medium">Invoice</th></tr></thead><tbody>{pageOrders.map((order) => <tr key={order.id} className={selectedOrderIds.includes(order.id) ? "bg-black/[0.025]" : "transition hover:bg-black/[0.02]"}><td className="border-b border-black/10 px-3 py-2.5"><input type="checkbox" checked={selectedOrderIds.includes(order.id)} onChange={() => toggleOrder(order.id)} aria-label={`Select order ${order.number}`} className="size-4 accent-black" /></td><td className="border-b border-black/10 px-3 py-2.5 font-medium"><Link href={`/dashboard/orders/${order.id}`} className="text-[#0c3152] hover:underline">{order.reference}</Link></td><td className="border-b border-black/10 px-3 py-2.5 text-black/65">{formatDate(order.createdAt)}</td><td className="border-b border-black/10 px-3 py-2.5"><span className="block font-medium">{order.customer?.name ?? "Guest"}</span><span className="mt-1 block text-[11px] text-black/50">{order.email}</span></td><td className="border-b border-black/10 px-3 py-2.5 text-right font-medium">{money(order.total, order.currency)}</td><td className="border-b border-black/10 px-3 py-2.5"><PaymentBadge order={order} /></td><td className="border-b border-black/10 px-3 py-2.5"><FulfillmentBadge status={order.status} /></td><td className="border-b border-black/10 px-3 py-2.5 text-right text-black/65">{order.itemCount} {order.itemCount === 1 ? "item" : "items"}</td><td className="border-b border-black/10 px-3 py-2.5 text-center"><Link href={`/dashboard/orders/${order.id}`} title={`View Order #${order.number} & Tax Invoice`} className="inline-flex items-center gap-1 rounded border border-black/15 bg-white px-2 py-1 text-[11px] font-medium text-black shadow-2xs transition hover:bg-black hover:text-white"><FileText className="size-3" /> Invoice</Link></td></tr>)}</tbody></table></div>
          {!pageOrders.length ? <div className="px-4 py-12 text-center"><p className="text-sm font-medium">No orders match your search.</p><p className="mt-1 text-xs text-black/55">Try a different search or create a new order.</p></div> : null}
          {pageOrders.length ? <div className="flex items-center justify-between border-t border-black/10 px-3 py-2 text-xs text-black/60"><span>{startIndex + 1}–{Math.min(startIndex + pageSize, filteredOrders.length)} of {filteredOrders.length}</span><div className="flex items-center gap-1"><button type="button" disabled={visiblePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous page" className="grid size-7 place-items-center rounded-md bg-black/5 transition hover:bg-black/10 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="size-4" /></button><button type="button" disabled={visiblePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} aria-label="Next page" className="grid size-7 place-items-center rounded-md bg-black/5 transition hover:bg-black/10 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight className="size-4" /></button></div></div> : null}
        </section>
      </div>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Cancel selected orders?</AlertDialogTitle><AlertDialogDescription>Only unfulfilled orders can be cancelled. This does not delete the order or its reporting history.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isPending}>Keep orders</AlertDialogCancel><AlertDialogAction disabled={isPending} onClick={() => { setCancelOpen(false); runAction("Cancelled:", cancelOrdersAction) }} className="bg-red-600 text-white hover:bg-red-700">{isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}Cancel orders</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </main>
  )
}
