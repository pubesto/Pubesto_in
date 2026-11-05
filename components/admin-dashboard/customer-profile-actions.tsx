"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  deleteCustomersAction,
  updateCustomerAction,
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
import type { AdminCustomerDetail } from "@/lib/server/dal/customers"

export function CustomerProfileActions({
  customer,
}: {
  customer: Pick<
    AdminCustomerDetail,
    "id" | "name" | "email" | "emailMarketingSubscribed"
  >
}) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState(customer.name)
  const [email, setEmail] = useState(customer.email)
  const [emailMarketingSubscribed, setEmailMarketingSubscribed] = useState(
    customer.emailMarketingSubscribed,
  )
  const [isPending, startTransition] = useTransition()

  const resetForm = () => {
    setName(customer.name)
    setEmail(customer.email)
    setEmailMarketingSubscribed(customer.emailMarketingSubscribed)
  }

  const saveCustomer = () => {
    startTransition(async () => {
      const result = await updateCustomerAction(customer.id, {
        name,
        email,
        emailMarketingSubscribed,
      })
      if (!result.success) {
        toast.error(result.message)
        return
      }

      setEditOpen(false)
      toast.success("Customer updated.")
      router.refresh()
    })
  }

  const deleteCustomer = () => {
    startTransition(async () => {
      const result = await deleteCustomersAction([customer.id])
      if (!result.success || result.count !== 1) {
        toast.error(result.success ? "Customer could not be deleted." : result.message)
        return
      }

      toast.success("Customer deleted.")
      router.replace("/dashboard/customers")
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setEditOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black/[0.06] px-3 text-xs font-medium transition hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"><Pencil className="size-3.5" /> Edit customer</button>
        <button type="button" onClick={() => setDeleteOpen(true)} className="grid size-9 place-items-center rounded-lg border border-red-200 text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500" aria-label={`Delete ${customer.name}`}><Trash2 className="size-3.5" /></button>
      </div>

      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) resetForm() }}>
        <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:!w-[480px] sm:!max-w-[480px]" overlayClassName="bg-black/45 supports-backdrop-filter:backdrop-blur-[1px]">
          <DialogHeader className="border-b border-black/10 px-5 py-4"><DialogTitle>Edit customer</DialogTitle><DialogDescription>Update the customer profile and marketing preference.</DialogDescription></DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); saveCustomer() }}><div className="space-y-4 px-5 py-4"><label className="grid gap-1.5 text-sm font-medium" htmlFor="edit-customer-name">Name<input id="edit-customer-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className="h-10 rounded-lg border border-black/25 bg-white px-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10" /></label><label className="grid gap-1.5 text-sm font-medium" htmlFor="edit-customer-email">Email<input id="edit-customer-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" className="h-10 rounded-lg border border-black/25 bg-white px-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10" /></label><label className="flex items-start gap-2 text-sm text-black/70"><input type="checkbox" checked={emailMarketingSubscribed} onChange={(event) => setEmailMarketingSubscribed(event.target.checked)} className="mt-0.5 size-4 accent-black" />Subscribe this customer to email marketing</label></div><DialogFooter className="flex-row justify-end border-t border-black/10 px-5 py-3"><button type="button" disabled={isPending} onClick={() => setEditOpen(false)} className="h-9 rounded-lg border border-black/15 px-3 text-sm font-medium transition hover:bg-black/[0.03] disabled:opacity-50">Cancel</button><button type="submit" disabled={isPending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-3 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/30">{isPending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}Save</button></DialogFooter></form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete customer?</AlertDialogTitle><AlertDialogDescription>This permanently removes {customer.name}&apos;s profile. Existing orders remain in reporting, but will no longer be connected to this customer.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel><AlertDialogAction disabled={isPending} onClick={deleteCustomer} className="bg-red-600 text-white hover:bg-red-700">{isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </>
  )
}
