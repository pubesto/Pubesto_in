"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRight, PackageOpen, Tag, Truck } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const discountTypes = [
  {
    title: "Amount off products",
    description: "Discount specific products or collections of products",
    icon: Tag,
  },
  {
    title: "Buy X get Y",
    description: "Discount specific products or collections of products",
    icon: Tag,
  },
  {
    title: "Amount off order",
    description: "Discount the total order amount",
    icon: PackageOpen,
  },
  {
    title: "Free shipping",
    description: "Offer free shipping on an order",
    icon: Truck,
  },
]

const discountTypeRoutes: Record<string, string> = {
  "Amount off products": "/dashboard/discounts/new",
  "Buy X get Y": "/dashboard/discounts/buy-x-get-y",
  "Amount off order": "/dashboard/discounts/amount-off-order",
  "Free shipping": "/dashboard/discounts/free-shipping",
}

export function CreateDiscountDialog() {
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-black px-3 text-xs font-medium text-white transition hover:bg-black/80"
        >
          Create discount
        </button>
      </DialogTrigger>

      <DialogContent
        className="w-[min(620px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[620px]"
        overlayClassName="bg-black/45"
      >
        <DialogHeader className="border-b border-black/10 px-4 py-5">
          <DialogTitle className="text-base font-semibold">
            Select discount type
          </DialogTitle>
          <DialogDescription className="sr-only">
            Choose the type of discount you want to create.
          </DialogDescription>
        </DialogHeader>

        <div role="list" aria-label="Discount types">
          {discountTypes.map((discountType, index) => {
            const Icon = discountType.icon
            const route = discountTypeRoutes[discountType.title]
            const optionClass = `flex min-h-[68px] w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-black/[0.05] ${index < discountTypes.length - 1 ? "border-b border-black/10" : ""} ${index === 0 ? "bg-black/[0.035]" : ""}`
            const optionContent = <><Icon className="size-4 shrink-0 text-black/75" /><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-black/80">{discountType.title}</span><span className="mt-1 block text-sm text-black/60">{discountType.description}</span></span><ChevronRight className="size-4 shrink-0 text-black/45" /></>

            return route ? (
              <Link key={discountType.title} href={route} className={optionClass}>
                {optionContent}
              </Link>
            ) : (
              <button
                key={discountType.title}
                type="button"
                role="listitem"
                onClick={() => setOpen(false)}
                className={optionClass}
              >
                {optionContent}
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
