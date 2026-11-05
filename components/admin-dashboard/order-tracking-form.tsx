"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Truck } from "lucide-react"
import { toast } from "sonner"

import { updateOrderTrackingAction } from "@/app/actions/orders"

const inputClass =
  "h-9 w-full rounded-lg border border-black/20 bg-white px-3 text-sm text-black outline-none transition focus:border-black/45 focus:ring-2 focus:ring-black/10"

/**
 * Courier and tracking number for an order. The customer sees these in
 * their account ("Track order") and the order moves to "shipped" there.
 */
export function OrderTrackingForm({
  order,
}: {
  order: {
    id: string
    status: string
    courier: string | null
    trackingNumber: string | null
    trackingUrl: string | null
  }
}) {
  const router = useRouter()
  const [courier, setCourier] = useState(order.courier ?? "")
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber ?? "")
  const [trackingUrl, setTrackingUrl] = useState(order.trackingUrl ?? "")
  const [isPending, startTransition] = useTransition()
  const canFulfil = order.status === "PENDING" || order.status === "CONFIRMED"

  function save(markFulfilled: boolean) {
    startTransition(async () => {
      const result = await updateOrderTrackingAction({
        orderId: order.id,
        courier,
        trackingNumber,
        trackingUrl,
        markFulfilled,
      })
      if (!result.success) {
        toast.error(result.message)
        return
      }
      toast.success(markFulfilled ? "Tracking saved and order fulfilled." : "Tracking saved.")
      router.refresh()
    })
  }

  return (
    <section className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-black/10 px-5 py-4">
        <Truck className="size-4 text-black/60" />
        <h2 className="text-sm font-semibold text-black">Shipping &amp; tracking</h2>
      </div>
      <div className="grid gap-3 px-5 py-4 text-xs">
        <label className="grid gap-1">
          <span className="font-medium text-black/70">Courier</span>
          <input
            className={inputClass}
            value={courier}
            maxLength={80}
            placeholder="Delhivery, Shiprocket, India Post…"
            onChange={(event) => setCourier(event.target.value)}
          />
        </label>
        <label className="grid gap-1">
          <span className="font-medium text-black/70">Tracking / AWB number</span>
          <input
            className={`${inputClass} font-mono`}
            value={trackingNumber}
            maxLength={80}
            onChange={(event) => setTrackingNumber(event.target.value)}
          />
        </label>
        <label className="grid gap-1">
          <span className="font-medium text-black/70">Tracking link (optional)</span>
          <input
            className={inputClass}
            value={trackingUrl}
            maxLength={500}
            placeholder="https://…"
            onChange={(event) => setTrackingUrl(event.target.value)}
          />
        </label>
        <div className="mt-1 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => save(false)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-black/15 bg-white px-3 text-xs font-medium transition hover:bg-black/[0.04] disabled:opacity-50"
          >
            {isPending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
            Save
          </button>
          {canFulfil ? (
            <button
              type="button"
              disabled={isPending || !trackingNumber.trim()}
              onClick={() => save(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-3 text-xs font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/30"
            >
              Save &amp; mark fulfilled
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
