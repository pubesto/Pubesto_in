"use client"

import Link from "next/link"
import { useState, useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { ExternalLink, ImageIcon, LoaderCircle, Search, Undo2 } from "lucide-react"
import { toast } from "sonner"

import { updateCancellationRequestAction, updateReturnRequestAction } from "@/app/actions/returns"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { AdminCancellationRequest, AdminReturnRequest, RequestTimelineEntry } from "@/lib/server/dal/returns"
import {
  CANCELLATION_STATUSES,
  CANCELLATION_STATUS_NOTES,
  RETURN_STATUSES,
  RETURN_STATUS_NOTES,
  cancellationStatusName,
  returnStatusName,
  type CancellationStatus,
  type ReturnStatus,
} from "@/lib/support-requests"

type Tab = "returns" | "cancellations"

const textareaClass =
  "w-full rounded-lg border border-black/25 bg-white px-3 py-2 text-sm font-normal outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 disabled:bg-black/[0.03]"

const statusTone: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  requested: "bg-amber-100 text-amber-900",
  under_review: "bg-sky-100 text-sky-900",
  approved: "bg-emerald-100 text-emerald-900",
  rejected: "bg-red-100 text-red-800",
  refund_initiated: "bg-violet-100 text-violet-900",
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold ${statusTone[status] ?? "bg-black/[0.07] text-black/60"}`}>
      {label}
    </span>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
}

function OrderReference({ orderRef, orderId }: { orderRef: string; orderId: string | null }) {
  if (!orderId) return <span>{orderRef}</span>
  return (
    <Link href={`/dashboard/orders/${orderId}`} className="inline-flex items-center gap-1 font-medium text-[#0c3152] hover:underline">
      {orderRef}
      <ExternalLink className="size-3" />
    </Link>
  )
}

function InfoGrid({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-black/50">{item.label}</dt>
          <dd className="mt-0.5 break-words font-medium">{item.value || <span className="text-black/35">—</span>}</dd>
        </div>
      ))}
    </dl>
  )
}

function Timeline({ entries, statusName }: { entries: RequestTimelineEntry[]; statusName: (status: string) => string }) {
  if (!entries.length) return <p className="text-xs text-black/50">No timeline entries yet.</p>
  return (
    <ol className="relative space-y-4 border-l border-black/10 pl-4">
      {entries.map((entry, index) => (
        <li key={`${entry.date}-${index}`} className="relative">
          <span className={`absolute -left-[21px] top-1 size-2.5 rounded-full ring-2 ring-white ${index === entries.length - 1 ? "bg-black" : "bg-black/25"}`} />
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold">{entry.label || statusName(entry.status)}</p>
            <span className="text-[11px] text-black/45">{formatDateTime(entry.date)}</span>
          </div>
          {entry.note ? <p className="mt-1 text-xs text-black/65">{entry.note}</p> : null}
        </li>
      ))}
    </ol>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-black/50">{children}</h3>
}

function ReturnDetail({ request, canManage, onSaved }: { request: AdminReturnRequest; canManage: boolean; onSaved: () => void }) {
  const [status, setStatus] = useState<ReturnStatus>((RETURN_STATUSES as readonly string[]).includes(request.status) ? (request.status as ReturnStatus) : "pending")
  const [adminNotes, setAdminNotes] = useState(request.adminNotes)
  const [adminInternalNotes, setAdminInternalNotes] = useState(request.adminInternalNotes)
  const [rejectionReason, setRejectionReason] = useState(request.rejectionReason)
  const [isPending, startTransition] = useTransition()
  const statusChanged = status !== request.status

  const save = () => {
    startTransition(async () => {
      const result = await updateReturnRequestAction({ id: request.id, status, adminNotes, adminInternalNotes, rejectionReason })
      if (!result.success) {
        toast.error(result.message)
        return
      }
      toast.success(result.statusChanged ? `Return marked ${returnStatusName(status).toLowerCase()}.` : "Return notes saved.")
      onSaved()
    })
  }

  return (
    <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-6">
      <InfoGrid
        items={[
          { label: "Customer", value: request.customerName },
          { label: "Email", value: <a href={`mailto:${request.customerEmail}`} className="text-[#0c3152] hover:underline">{request.customerEmail}</a> },
          { label: "Phone", value: request.customerPhone ? <a href={`tel:${request.customerPhone}`} className="hover:underline">{request.customerPhone}</a> : "" },
          { label: "Order", value: <OrderReference orderRef={request.orderRef} orderId={request.orderId} /> },
          { label: "Product", value: request.productName },
          { label: "Submitted", value: formatDateTime(request.createdAt) },
        ]}
      />

      <section className="space-y-2">
        <SectionTitle>Reason</SectionTitle>
        <p className="text-sm font-medium">{request.reason}</p>
        {request.reasonText ? <p className="whitespace-pre-wrap rounded-lg bg-black/[0.03] px-3 py-2 text-xs text-black/70">{request.reasonText}</p> : null}
      </section>

      <section className="space-y-2">
        <SectionTitle>Photos ({request.images.length})</SectionTitle>
        {request.images.length ? (
          <div className="grid grid-cols-3 gap-2">
            {request.images.map((url, index) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-lg border border-black/10 bg-black/[0.03]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Return photo ${index + 1}`} className="aspect-square w-full object-cover transition group-hover:scale-105" />
              </a>
            ))}
          </div>
        ) : (
          <p className="text-xs text-black/50">The customer didn&apos;t attach any photos.</p>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle>Timeline</SectionTitle>
        <Timeline entries={request.timeline} statusName={returnStatusName} />
      </section>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
        className="space-y-4 rounded-xl border border-black/10 p-4"
      >
        <SectionTitle>Update request</SectionTitle>
        <div className="grid gap-1.5 text-sm font-medium">
          Status
          <Select value={status} onValueChange={(value) => setStatus(value as ReturnStatus)} disabled={!canManage || isPending}>
            <SelectTrigger aria-label="Return status" className="h-10 w-full rounded-lg border-black/25 bg-white px-3 text-sm font-normal shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {RETURN_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {returnStatusName(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {statusChanged ? (
            <p className="text-[11px] font-normal text-black/55">
              Saving adds a timeline entry the customer can see. Unless you edit the customer note, it will read: “{RETURN_STATUS_NOTES[status]}”
            </p>
          ) : null}
        </div>
        {status === "rejected" ? (
          <label className="grid gap-1.5 text-sm font-medium">
            Rejection reason
            <textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={2} disabled={!canManage || isPending} placeholder="Shown to the customer on the tracking page" className={textareaClass} />
          </label>
        ) : null}
        <label className="grid gap-1.5 text-sm font-medium">
          Customer note
          <textarea value={adminNotes} onChange={(event) => setAdminNotes(event.target.value)} rows={3} disabled={!canManage || isPending} placeholder="Visible to the customer on the return tracking page" className={textareaClass} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Internal note
          <textarea value={adminInternalNotes} onChange={(event) => setAdminInternalNotes(event.target.value)} rows={3} disabled={!canManage || isPending} placeholder="Only visible to staff" className={textareaClass} />
        </label>
        {canManage ? (
          <div className="flex justify-end">
            <button type="submit" disabled={isPending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-3 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/30">
              {isPending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
              {statusChanged ? "Update status" : "Save notes"}
            </button>
          </div>
        ) : (
          <p className="text-xs text-black/50">You can view this request but need the “returns.manage” permission to change it.</p>
        )}
      </form>
    </div>
  )
}

function CancellationDetail({ request, canManage, onSaved }: { request: AdminCancellationRequest; canManage: boolean; onSaved: () => void }) {
  const [status, setStatus] = useState<CancellationStatus>(
    (CANCELLATION_STATUSES as readonly string[]).includes(request.status) ? (request.status as CancellationStatus) : "requested",
  )
  const [adminNotes, setAdminNotes] = useState(request.adminNotes)
  const [adminInternalNotes, setAdminInternalNotes] = useState(request.adminInternalNotes)
  const [isPending, startTransition] = useTransition()
  const statusChanged = status !== request.status

  const save = () => {
    startTransition(async () => {
      const result = await updateCancellationRequestAction({ id: request.id, status, adminNotes, adminInternalNotes })
      if (!result.success) {
        toast.error(result.message)
        return
      }
      toast.success(result.statusChanged ? `Cancellation marked ${cancellationStatusName(status).toLowerCase()}.` : "Cancellation notes saved.")
      onSaved()
    })
  }

  return (
    <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-6">
      <InfoGrid
        items={[
          { label: "Customer", value: request.customerName },
          { label: "Email", value: <a href={`mailto:${request.customerEmail}`} className="text-[#0c3152] hover:underline">{request.customerEmail}</a> },
          { label: "Phone", value: request.customerPhone ? <a href={`tel:${request.customerPhone}`} className="hover:underline">{request.customerPhone}</a> : "" },
          { label: "Order", value: <OrderReference orderRef={request.orderRef} orderId={request.orderId} /> },
          { label: "Payment method", value: request.paymentMethod },
          { label: "Submitted", value: formatDateTime(request.createdAt) },
        ]}
      />

      <section className="space-y-2">
        <SectionTitle>Reason</SectionTitle>
        <p className="text-sm font-medium">{request.reason}</p>
        {request.reasonText ? <p className="whitespace-pre-wrap rounded-lg bg-black/[0.03] px-3 py-2 text-xs text-black/70">{request.reasonText}</p> : null}
      </section>

      <section className="space-y-3">
        <SectionTitle>Timeline</SectionTitle>
        <Timeline entries={request.timeline} statusName={cancellationStatusName} />
      </section>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
        className="space-y-4 rounded-xl border border-black/10 p-4"
      >
        <SectionTitle>Update request</SectionTitle>
        <p className="text-[11px] text-black/55">
          The order itself was cancelled when the customer submitted this request. Changing the status here only updates the request and its timeline; manage the order and any refund from the order page.
        </p>
        <div className="grid gap-1.5 text-sm font-medium">
          Status
          <Select value={status} onValueChange={(value) => setStatus(value as CancellationStatus)} disabled={!canManage || isPending}>
            <SelectTrigger aria-label="Cancellation status" className="h-10 w-full rounded-lg border-black/25 bg-white px-3 text-sm font-normal shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {CANCELLATION_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {cancellationStatusName(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {statusChanged ? (
            <p className="text-[11px] font-normal text-black/55">
              Saving adds a timeline entry the customer can see. Unless you edit the customer note, it will read: “{CANCELLATION_STATUS_NOTES[status]}”
            </p>
          ) : null}
        </div>
        <label className="grid gap-1.5 text-sm font-medium">
          Customer note
          <textarea value={adminNotes} onChange={(event) => setAdminNotes(event.target.value)} rows={3} disabled={!canManage || isPending} placeholder="Visible to the customer when they track this request" className={textareaClass} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Internal note
          <textarea value={adminInternalNotes} onChange={(event) => setAdminInternalNotes(event.target.value)} rows={3} disabled={!canManage || isPending} placeholder="Only visible to staff" className={textareaClass} />
        </label>
        {canManage ? (
          <div className="flex justify-end">
            <button type="submit" disabled={isPending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-3 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/30">
              {isPending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
              {statusChanged ? "Update status" : "Save notes"}
            </button>
          </div>
        ) : (
          <p className="text-xs text-black/50">You can view this request but need the “returns.manage” permission to change it.</p>
        )}
      </form>
    </div>
  )
}

export function ReturnManager({
  returns,
  cancellations,
  initialTab,
  canManage,
}: {
  returns: AdminReturnRequest[]
  cancellations: AdminCancellationRequest[]
  initialTab: Tab
  canManage: boolean
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [query, setQuery] = useState("")
  const [returnStatus, setReturnStatus] = useState<"ALL" | ReturnStatus>("ALL")
  const [cancellationStatus, setCancellationStatus] = useState<"ALL" | CancellationStatus>("ALL")
  const [openId, setOpenId] = useState<string | null>(null)

  const normalizedQuery = query.trim().toLowerCase()
  const matchesQuery = (values: string[]) => !normalizedQuery || values.some((value) => value.toLowerCase().includes(normalizedQuery))

  const visibleReturns = returns.filter(
    (request) =>
      (returnStatus === "ALL" || request.status === returnStatus) &&
      matchesQuery([request.id, request.orderRef, request.customerName, request.customerEmail, request.productName, request.reason]),
  )
  const visibleCancellations = cancellations.filter(
    (request) =>
      (cancellationStatus === "ALL" || request.status === cancellationStatus) &&
      matchesQuery([request.id, request.orderRef, request.customerName, request.customerEmail, request.reason]),
  )

  const openReturn = tab === "returns" ? returns.find((request) => request.id === openId) ?? null : null
  const openCancellation = tab === "cancellations" ? cancellations.find((request) => request.id === openId) ?? null : null
  const pendingReturns = returns.filter((request) => request.status === "pending" || request.status === "under_review").length
  const openCancellations = cancellations.filter((request) => request.status === "requested").length

  const switchTab = (next: Tab) => {
    setTab(next)
    setOpenId(null)
    const url = new URL(window.location.href)
    if (next === "cancellations") url.searchParams.set("tab", "cancellations")
    else url.searchParams.delete("tab")
    window.history.replaceState(null, "", url)
  }

  const onSaved = () => router.refresh()

  return (
    <main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-5">
      <div className="w-full">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <Undo2 className="size-4" />
              Returns &amp; cancellations
            </h1>
            <p className="mt-1 text-xs text-black/55">Review customer requests, keep them updated, and record what was decided.</p>
          </div>
        </header>

        <div className="mt-4 inline-flex rounded-lg border border-black/10 bg-white p-0.5 shadow-sm">
          {(
            [
              { value: "returns", label: "Returns", count: pendingReturns },
              { value: "cancellations", label: "Cancellations", count: openCancellations },
            ] as const
          ).map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => switchTab(item.value)}
              aria-pressed={tab === item.value}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition ${tab === item.value ? "bg-black text-white" : "text-black/60 hover:bg-black/[0.04]"}`}
            >
              {item.label}
              {item.count ? (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tab === item.value ? "bg-white/20" : "bg-amber-100 text-amber-900"}`}>{item.count}</span>
              ) : null}
            </button>
          ))}
        </div>

        <section className="mt-3 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-black/10 px-4 py-3">
            <label className="flex min-w-52 flex-1 items-center gap-2 text-sm text-black/50">
              <Search className="size-4" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label={tab === "returns" ? "Search returns" : "Search cancellations"}
                placeholder="Search by request ID, order, customer or reason"
                className="w-full bg-transparent outline-none placeholder:text-black/45"
              />
            </label>
            {tab === "returns" ? (
              <Select value={returnStatus} onValueChange={(value) => setReturnStatus(value as "ALL" | ReturnStatus)}>
                <SelectTrigger aria-label="Filter returns by status" className="h-8 w-40 rounded-md border-black/15 bg-white px-2 text-xs font-medium shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="ALL">All returns</SelectItem>
                  {RETURN_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {returnStatusName(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={cancellationStatus} onValueChange={(value) => setCancellationStatus(value as "ALL" | CancellationStatus)}>
                <SelectTrigger aria-label="Filter cancellations by status" className="h-8 w-40 rounded-md border-black/15 bg-white px-2 text-xs font-medium shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="ALL">All cancellations</SelectItem>
                  {CANCELLATION_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {cancellationStatusName(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <span className="text-xs text-black/45">
              {tab === "returns"
                ? `${visibleReturns.length} ${visibleReturns.length === 1 ? "return" : "returns"}`
                : `${visibleCancellations.length} ${visibleCancellations.length === 1 ? "cancellation" : "cancellations"}`}
            </span>
          </div>

          <div className="overflow-x-auto">
            {tab === "returns" ? (
              <table className="w-full min-w-[960px] border-collapse text-left text-xs">
                <thead className="bg-black/[0.025] text-black/65">
                  <tr>
                    <th className="border-b border-black/10 px-3 py-2.5 font-medium">Request</th>
                    <th className="border-b border-black/10 px-3 py-2.5 font-medium">Customer</th>
                    <th className="border-b border-black/10 px-3 py-2.5 font-medium">Order</th>
                    <th className="border-b border-black/10 px-3 py-2.5 font-medium">Product &amp; reason</th>
                    <th className="border-b border-black/10 px-3 py-2.5 font-medium">Photos</th>
                    <th className="border-b border-black/10 px-3 py-2.5 font-medium">Status</th>
                    <th className="border-b border-black/10 px-3 py-2.5 text-right font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleReturns.map((request) => (
                    <tr key={request.id} onClick={() => setOpenId(request.id)} className="cursor-pointer transition hover:bg-black/[0.02]">
                      <td className="border-b border-black/10 px-3 py-3">
                        <button type="button" onClick={(event) => { event.stopPropagation(); setOpenId(request.id) }} className="text-sm font-semibold text-[#0c3152] hover:underline">
                          {request.id}
                        </button>
                      </td>
                      <td className="border-b border-black/10 px-3 py-3">
                        <p className="font-medium">{request.customerName}</p>
                        <p className="mt-0.5 text-[11px] text-black/50">{request.customerEmail}</p>
                      </td>
                      <td className="border-b border-black/10 px-3 py-3" onClick={(event) => event.stopPropagation()}>
                        <OrderReference orderRef={request.orderRef} orderId={request.orderId} />
                      </td>
                      <td className="max-w-sm border-b border-black/10 px-3 py-3">
                        <p className="truncate font-medium">{request.productName || "—"}</p>
                        <p className="mt-0.5 truncate text-[11px] text-black/55">{request.reason}</p>
                      </td>
                      <td className="border-b border-black/10 px-3 py-3 text-black/60">
                        {request.images.length ? (
                          <span className="inline-flex items-center gap-1">
                            <ImageIcon className="size-3.5" />
                            {request.images.length}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="border-b border-black/10 px-3 py-3">
                        <StatusBadge status={request.status} label={returnStatusName(request.status)} />
                      </td>
                      <td className="border-b border-black/10 px-3 py-3 text-right text-black/60">{formatDate(request.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[900px] border-collapse text-left text-xs">
                <thead className="bg-black/[0.025] text-black/65">
                  <tr>
                    <th className="border-b border-black/10 px-3 py-2.5 font-medium">Request</th>
                    <th className="border-b border-black/10 px-3 py-2.5 font-medium">Customer</th>
                    <th className="border-b border-black/10 px-3 py-2.5 font-medium">Order</th>
                    <th className="border-b border-black/10 px-3 py-2.5 font-medium">Reason</th>
                    <th className="border-b border-black/10 px-3 py-2.5 font-medium">Payment</th>
                    <th className="border-b border-black/10 px-3 py-2.5 font-medium">Status</th>
                    <th className="border-b border-black/10 px-3 py-2.5 text-right font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCancellations.map((request) => (
                    <tr key={request.id} onClick={() => setOpenId(request.id)} className="cursor-pointer transition hover:bg-black/[0.02]">
                      <td className="border-b border-black/10 px-3 py-3">
                        <button type="button" onClick={(event) => { event.stopPropagation(); setOpenId(request.id) }} className="text-sm font-semibold text-[#0c3152] hover:underline">
                          {request.id}
                        </button>
                      </td>
                      <td className="border-b border-black/10 px-3 py-3">
                        <p className="font-medium">{request.customerName}</p>
                        <p className="mt-0.5 text-[11px] text-black/50">{request.customerEmail}</p>
                      </td>
                      <td className="border-b border-black/10 px-3 py-3" onClick={(event) => event.stopPropagation()}>
                        <OrderReference orderRef={request.orderRef} orderId={request.orderId} />
                      </td>
                      <td className="max-w-sm border-b border-black/10 px-3 py-3">
                        <p className="truncate">{request.reason}</p>
                      </td>
                      <td className="border-b border-black/10 px-3 py-3 text-black/60">{request.paymentMethod || "—"}</td>
                      <td className="border-b border-black/10 px-3 py-3">
                        <StatusBadge status={request.status} label={cancellationStatusName(request.status)} />
                      </td>
                      <td className="border-b border-black/10 px-3 py-3 text-right text-black/60">{formatDate(request.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {(tab === "returns" ? !visibleReturns.length : !visibleCancellations.length) ? (
            <div className="px-6 py-16 text-center">
              <Undo2 className="mx-auto size-7 text-black/35" />
              <p className="mt-3 text-sm font-semibold">
                {(tab === "returns" ? returns.length : cancellations.length) ? "No requests match your filters." : tab === "returns" ? "No return requests yet." : "No cancellation requests yet."}
              </p>
              <p className="mt-1 text-xs text-black/55">Requests customers submit from the storefront appear here.</p>
            </div>
          ) : null}
        </section>
      </div>

      <Sheet open={Boolean(openReturn || openCancellation)} onOpenChange={(open) => { if (!open) setOpenId(null) }}>
        <SheetContent className="gap-0 bg-white text-black" overlayClassName="bg-black/30">
          {openReturn ? (
            <>
              <SheetHeader className="px-5 pt-5 pb-4">
                <div className="flex items-center gap-2 pr-8">
                  <SheetTitle>Return {openReturn.id}</SheetTitle>
                  <StatusBadge status={openReturn.status} label={returnStatusName(openReturn.status)} />
                </div>
                <SheetDescription>Last updated {formatDateTime(openReturn.updatedAt)}</SheetDescription>
              </SheetHeader>
              <ReturnDetail key={`${openReturn.id}-${openReturn.updatedAt}`} request={openReturn} canManage={canManage} onSaved={onSaved} />
            </>
          ) : null}
          {openCancellation ? (
            <>
              <SheetHeader className="px-5 pt-5 pb-4">
                <div className="flex items-center gap-2 pr-8">
                  <SheetTitle>Cancellation {openCancellation.id}</SheetTitle>
                  <StatusBadge status={openCancellation.status} label={cancellationStatusName(openCancellation.status)} />
                </div>
                <SheetDescription>Last updated {formatDateTime(openCancellation.updatedAt)}</SheetDescription>
              </SheetHeader>
              <CancellationDetail key={`${openCancellation.id}-${openCancellation.updatedAt}`} request={openCancellation} canManage={canManage} onSaved={onSaved} />
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </main>
  )
}
