"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCheck, LoaderCircle, Mail, MailOpen, Reply, Search, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { deleteMessagesAction, setMessageStatusAction } from "@/app/actions/messages"
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { AdminContactMessage } from "@/lib/server/dal/messages"

type MessageStatus = AdminContactMessage["status"]
type StatusFilter = "ALL" | MessageStatus

const statusLabels: Record<MessageStatus, string> = { NEW: "New", READ: "Read", RESOLVED: "Resolved" }
const statusTone: Record<MessageStatus, string> = {
  NEW: "bg-amber-100 text-amber-900",
  READ: "bg-sky-100 text-sky-900",
  RESOLVED: "bg-emerald-100 text-emerald-900",
}

function StatusBadge({ status }: { status: MessageStatus }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold ${statusTone[status]}`}>{statusLabels[status]}</span>
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
}

function replyHref(message: AdminContactMessage) {
  const subject = message.subject.toLowerCase().startsWith("re:") ? message.subject : `Re: ${message.subject}`
  const quoted = message.message
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n")
  const body = `Hi ${message.name},\n\n\n\n— Team Pubesto\n\nOn ${formatDateTime(message.createdAt)}, ${message.name} wrote:\n${quoted}`
  return `mailto:${encodeURIComponent(message.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function MessageManager({ messages, canManage }: { messages: AdminContactMessage[]; canManage: boolean }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("ALL")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [messagesToDelete, setMessagesToDelete] = useState<string[] | null>(null)
  const [isPending, startTransition] = useTransition()

  const newCount = messages.filter((message) => message.status === "NEW").length
  const normalizedQuery = query.trim().toLowerCase()
  const visibleMessages = useMemo(
    () =>
      messages.filter((message) => {
        const matches =
          !normalizedQuery ||
          [message.name, message.email, message.subject, message.message].some((value) => value.toLowerCase().includes(normalizedQuery))
        return matches && (status === "ALL" || message.status === status)
      }),
    [messages, normalizedQuery, status],
  )
  const allSelected = visibleMessages.length > 0 && visibleMessages.every((message) => selectedIds.includes(message.id))
  const openMessage = messages.find((message) => message.id === openId) ?? null

  const toggleAll = () => {
    const ids = visibleMessages.map((message) => message.id)
    setSelectedIds((current) => (allSelected ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])]))
  }
  const toggleMessage = (id: string) =>
    setSelectedIds((current) => (current.includes(id) ? current.filter((currentId) => currentId !== id) : [...current, id]))

  const changeStatus = (ids: string[], nextStatus: MessageStatus, options: { quiet?: boolean } = {}) => {
    if (!ids.length) return
    startTransition(async () => {
      const result = await setMessageStatusAction({ ids, status: nextStatus })
      if (!result.success) {
        if (!options.quiet) toast.error(result.message)
        return
      }
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)))
      if (!options.quiet) {
        toast.success(`${result.count} ${result.count === 1 ? "message" : "messages"} marked ${statusLabels[nextStatus].toLowerCase()}.`)
      }
      router.refresh()
    })
  }

  const open = (message: AdminContactMessage) => {
    setOpenId(message.id)
    // Opening a new message marks it read, as an inbox would.
    if (message.status === "NEW" && canManage) changeStatus([message.id], "READ", { quiet: true })
  }

  const deleteMessages = () => {
    if (!messagesToDelete?.length) return
    const ids = messagesToDelete
    startTransition(async () => {
      const result = await deleteMessagesAction(ids)
      if (!result.success) {
        toast.error(result.message)
        return
      }
      setMessagesToDelete(null)
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)))
      if (openId && ids.includes(openId)) setOpenId(null)
      toast.success(result.count === 1 ? "Message deleted." : `${result.count} messages deleted.`)
      router.refresh()
    })
  }

  return (
    <main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-5">
      <div className="w-full">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <Mail className="size-4" />
              Messages
              {newCount ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">{newCount} new</span> : null}
            </h1>
            <p className="mt-1 text-xs text-black/55">Messages customers send through the contact form. Reply by email, then mark them resolved.</p>
          </div>
        </header>

        <section className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-black/10 px-4 py-3">
            <label className="flex min-w-52 flex-1 items-center gap-2 text-sm text-black/50">
              <Search className="size-4" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search messages"
                placeholder="Search by name, email, subject or message"
                className="w-full bg-transparent outline-none placeholder:text-black/45"
              />
            </label>
            <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
              <SelectTrigger aria-label="Filter messages by status" className="h-8 w-36 rounded-md border-black/15 bg-white px-2 text-xs font-medium shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="ALL">All messages</SelectItem>
                <SelectItem value="NEW">New</SelectItem>
                <SelectItem value="READ">Read</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-black/45">
              {visibleMessages.length} {visibleMessages.length === 1 ? "message" : "messages"}
            </span>
          </div>

          {selectedIds.length ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-black/10 bg-black/[0.02] px-3 py-2">
              <button type="button" onClick={() => setSelectedIds([])} aria-label="Clear message selection" className="grid size-7 place-items-center rounded-md text-black/55 transition hover:bg-black/[0.06]">
                <X className="size-4" />
              </button>
              <span className="text-xs font-semibold">{selectedIds.length} selected</span>
              {canManage ? (
                <>
                  <button type="button" disabled={isPending} onClick={() => changeStatus(selectedIds, "READ")} className="h-7 rounded-md border border-black/15 bg-white px-2.5 text-xs font-medium transition hover:bg-black/[0.04] disabled:opacity-50">
                    Mark read
                  </button>
                  <button type="button" disabled={isPending} onClick={() => changeStatus(selectedIds, "RESOLVED")} className="h-7 rounded-md border border-black/15 bg-white px-2.5 text-xs font-medium transition hover:bg-black/[0.04] disabled:opacity-50">
                    Mark resolved
                  </button>
                  <button type="button" disabled={isPending} onClick={() => changeStatus(selectedIds, "NEW")} className="h-7 rounded-md border border-black/15 bg-white px-2.5 text-xs font-medium transition hover:bg-black/[0.04] disabled:opacity-50">
                    Mark unread
                  </button>
                  <button type="button" disabled={isPending} onClick={() => setMessagesToDelete(selectedIds)} className="inline-flex h-7 items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50">
                    <Trash2 className="size-3" />
                    Delete
                  </button>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-xs">
              <thead className="bg-black/[0.025] text-black/65">
                <tr>
                  <th className="w-12 border-b border-black/10 px-3 py-2.5">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all visible messages" className="size-4 accent-black" />
                  </th>
                  <th className="border-b border-black/10 px-3 py-2.5 font-medium">From</th>
                  <th className="border-b border-black/10 px-3 py-2.5 font-medium">Message</th>
                  <th className="border-b border-black/10 px-3 py-2.5 font-medium">Status</th>
                  <th className="border-b border-black/10 px-3 py-2.5 text-right font-medium">Received</th>
                </tr>
              </thead>
              <tbody>
                {visibleMessages.map((message) => {
                  const selected = selectedIds.includes(message.id)
                  const unread = message.status === "NEW"
                  return (
                    <tr key={message.id} onClick={() => open(message)} className={`cursor-pointer ${selected ? "bg-black/[0.025]" : unread ? "bg-amber-50/60 transition hover:bg-amber-50" : "transition hover:bg-black/[0.02]"}`}>
                      <td className="border-b border-black/10 px-3 py-3 align-top" onClick={(event) => event.stopPropagation()}>
                        <input type="checkbox" checked={selected} onChange={() => toggleMessage(message.id)} aria-label={`Select message from ${message.name}`} className="size-4 accent-black" />
                      </td>
                      <td className="border-b border-black/10 px-3 py-3 align-top">
                        <p className={unread ? "font-semibold" : "font-medium"}>{message.name}</p>
                        <p className="mt-0.5 text-[11px] text-black/50">{message.email}</p>
                      </td>
                      <td className="max-w-xl border-b border-black/10 px-3 py-3 align-top">
                        <p className={`truncate ${unread ? "font-semibold text-[#0c3152]" : "font-medium text-[#0c3152]"}`}>{message.subject}</p>
                        <p className="mt-0.5 line-clamp-2 text-black/60">{message.message}</p>
                      </td>
                      <td className="border-b border-black/10 px-3 py-3 align-top">
                        <StatusBadge status={message.status} />
                      </td>
                      <td className="whitespace-nowrap border-b border-black/10 px-3 py-3 text-right align-top text-black/60">{formatDateTime(message.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {!visibleMessages.length ? (
            <div className="px-6 py-16 text-center">
              <Mail className="mx-auto size-7 text-black/35" />
              <p className="mt-3 text-sm font-semibold">{messages.length ? "No messages match your filters." : "No messages yet."}</p>
              <p className="mt-1 text-xs text-black/55">Messages sent from the storefront contact page appear here.</p>
            </div>
          ) : null}
        </section>
      </div>

      <Sheet open={Boolean(openMessage)} onOpenChange={(value) => { if (!value) setOpenId(null) }}>
        <SheetContent className="gap-0 bg-white text-black" overlayClassName="bg-black/30">
          {openMessage ? (
            <>
              <SheetHeader className="px-5 pt-5 pb-4">
                <div className="flex items-center gap-2 pr-8">
                  <SheetTitle className="break-words">{openMessage.subject}</SheetTitle>
                </div>
                <SheetDescription>
                  {openMessage.name} · {openMessage.email} · {formatDateTime(openMessage.createdAt)}
                </SheetDescription>
                <div>
                  <StatusBadge status={openMessage.status} />
                </div>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-5 pb-6">
                <p className="whitespace-pre-wrap rounded-lg bg-black/[0.03] px-4 py-3 text-sm leading-relaxed text-black/80">{openMessage.message}</p>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <a href={replyHref(openMessage)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-3 text-xs font-medium text-white transition hover:bg-black/80">
                    <Reply className="size-3.5" />
                    Reply by email
                  </a>
                  {canManage ? (
                    <>
                      {openMessage.status !== "RESOLVED" ? (
                        <button type="button" disabled={isPending} onClick={() => changeStatus([openMessage.id], "RESOLVED")} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black/[0.06] px-3 text-xs font-medium transition hover:bg-black/10 disabled:opacity-50">
                          <CheckCheck className="size-3.5" />
                          Mark resolved
                        </button>
                      ) : (
                        <button type="button" disabled={isPending} onClick={() => changeStatus([openMessage.id], "READ")} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black/[0.06] px-3 text-xs font-medium transition hover:bg-black/10 disabled:opacity-50">
                          <MailOpen className="size-3.5" />
                          Reopen
                        </button>
                      )}
                      {openMessage.status !== "NEW" ? (
                        <button type="button" disabled={isPending} onClick={() => { changeStatus([openMessage.id], "NEW"); setOpenId(null) }} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black/[0.06] px-3 text-xs font-medium transition hover:bg-black/10 disabled:opacity-50">
                          <Mail className="size-3.5" />
                          Mark unread
                        </button>
                      ) : null}
                      <button type="button" disabled={isPending} onClick={() => setMessagesToDelete([openMessage.id])} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50">
                        <Trash2 className="size-3.5" />
                        Delete
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(messagesToDelete?.length)} onOpenChange={(value) => { if (!value) setMessagesToDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {messagesToDelete?.length === 1 ? "message" : `${messagesToDelete?.length ?? 0} messages`}?</AlertDialogTitle>
            <AlertDialogDescription>The message will be permanently removed. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={deleteMessages} className="bg-red-600 text-white hover:bg-red-700">
              {isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
