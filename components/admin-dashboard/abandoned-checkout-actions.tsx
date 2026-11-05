"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Trash2 } from "lucide-react"
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

export function AbandonedCheckoutActions({ checkoutId }: { checkoutId: string }) {
  const router = useRouter()
  const [clearOpen, setClearOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const recover = () => {
    startTransition(async () => {
      const result = await recoverAbandonedCheckoutsAction([checkoutId])
      if (!result.success) {
        toast.error(result.message)
        return
      }
      toast.success("Pending order created from this checkout.")
      router.replace(result.orderIds?.[0] ? `/dashboard/orders/${result.orderIds[0]}` : "/dashboard/orders")
      router.refresh()
    })
  }

  const clear = () => {
    startTransition(async () => {
      const result = await clearAbandonedCheckoutsAction([checkoutId])
      if (!result.success) {
        toast.error(result.message)
        return
      }
      toast.success("Checkout cart cleared.")
      router.replace("/dashboard/orders/abandoned-checkouts")
      router.refresh()
    })
  }

  return <><div className="flex flex-wrap items-center gap-2"><button type="button" disabled={isPending} onClick={recover} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-3 text-xs font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/30">{isPending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}Create pending order</button><button type="button" disabled={isPending} onClick={() => setClearOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"><Trash2 className="size-3.5" />Clear cart</button></div><AlertDialog open={clearOpen} onOpenChange={setClearOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Clear this cart?</AlertDialogTitle><AlertDialogDescription>This permanently removes its products. The checkout will no longer appear in the abandoned checkout list.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isPending}>Keep cart</AlertDialogCancel><AlertDialogAction disabled={isPending} onClick={() => { setClearOpen(false); clear() }} className="bg-red-600 text-white hover:bg-red-700">{isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}Clear cart</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>
}
