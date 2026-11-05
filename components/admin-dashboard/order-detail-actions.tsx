"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle } from "lucide-react"
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
import type { AdminOrderDetail } from "@/lib/server/dal/orders"

export function OrderDetailActions({
  order,
}: {
  order: Pick<AdminOrderDetail, "id" | "status" | "paymentStatus" | "paymentMethod">
}) {
  const router = useRouter()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const runAction = (
    label: string,
    action: (orderIds: string[]) => Promise<{ success: boolean; message?: string }>,
  ) => {
    startTransition(async () => {
      const result = await action([order.id])
      if (!result.success) {
        toast.error(result.message)
        return
      }

      toast.success(label)
      router.refresh()
    })
  }

  const isCod = order.paymentMethod === "COD"
  if (order.status === "CANCELLED") return null
  if (order.status === "FULFILLED") {
    // Delivered COD order: let staff record the cash as collected.
    return isCod && order.paymentStatus !== "PAID" ? (
      <button type="button" disabled={isPending} onClick={() => runAction("Payment recorded.", markOrdersPaidAction)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-3 text-xs font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/30">{isPending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}Mark COD as collected</button>
    ) : null
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {order.status === "PENDING" && !isCod ? <button type="button" disabled={isPending} onClick={() => runAction("Order marked as paid.", markOrdersPaidAction)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-3 text-xs font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/30">{isPending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}Mark as paid</button> : null}
        {order.status === "CONFIRMED" || (order.status === "PENDING" && isCod) ? <button type="button" disabled={isPending} onClick={() => runAction("Order fulfilled and inventory updated.", fulfillOrdersAction)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-3 text-xs font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/30">{isPending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}Fulfill order</button> : null}
        <button type="button" disabled={isPending} onClick={() => setCancelOpen(true)} className="h-9 rounded-lg border border-red-200 px-3 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">Cancel order</button>
      </div>
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Cancel this order?</AlertDialogTitle><AlertDialogDescription>This keeps the order in reporting, but it can no longer be fulfilled.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isPending}>Keep order</AlertDialogCancel><AlertDialogAction disabled={isPending} onClick={() => { setCancelOpen(false); runAction("Order cancelled.", cancelOrdersAction) }} className="bg-red-600 text-white hover:bg-red-700">{isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}Cancel order</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </>
  )
}
