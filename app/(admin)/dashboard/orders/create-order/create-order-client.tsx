"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronRight,
  ClipboardPenLine,
  LoaderCircle,
  Minus,
  PackagePlus,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { createDraftOrderAction } from "@/app/actions/drafts"
import { createOrderAction } from "@/app/actions/orders"
import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import type {
  AdminOrderCreateOption,
  AdminOrderCustomerOption,
} from "@/lib/server/dal/orders"

type LineItem = { variantId: string; quantity: number }

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function Card({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

export function CreateOrderClient({
  variants,
  customers,
  mode = "order",
}: {
  variants: AdminOrderCreateOption[]
  customers: AdminOrderCustomerOption[]
  mode?: "order" | "draft"
}) {
  const router = useRouter()
  const isDraft = mode === "draft"
  const listPath = isDraft ? "/dashboard/orders/drafts" : "/dashboard/orders"
  const recordLabel = isDraft ? "draft order" : "order"
  const [items, setItems] = useState<LineItem[]>([])
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [customerQuery, setCustomerQuery] = useState("")
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"PENDING" | "CONFIRMED">("PENDING")
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState("")
  const [isPending, startTransition] = useTransition()
  const variantsById = useMemo(
    () => new Map(variants.map((variant) => [variant.id, variant])),
    [variants],
  )
  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? null
  const visibleCustomers = customers
    .filter((customer) =>
      [customer.name, customer.email].some((value) =>
        value.toLowerCase().includes(customerQuery.trim().toLowerCase()),
      ),
    )
    .slice(0, 6)
  const pickerVariants = variants.filter((variant) =>
    [variant.productTitle, variant.title, variant.sku].some((value) =>
      value.toLowerCase().includes(pickerQuery.trim().toLowerCase()),
    ),
  )
  const subtotal = items.reduce((sum, item) => {
    const variant = variantsById.get(item.variantId)
    return sum + (variant ? variant.price * item.quantity : 0)
  }, 0)

  const addVariant = (variantId: string) => {
    setItems((current) => {
      const existing = current.find((item) => item.variantId === variantId)
      if (existing) {
        return current.map((item) =>
          item.variantId === variantId
            ? { ...item, quantity: Math.min(item.quantity + 1, 100) }
            : item,
        )
      }
      return [...current, { variantId, quantity: 1 }]
    })
  }

  const updateQuantity = (variantId: string, nextQuantity: number) => {
    if (!Number.isInteger(nextQuantity) || nextQuantity < 1) {
      setItems((current) => current.filter((item) => item.variantId !== variantId))
      return
    }
    setItems((current) =>
      current.map((item) =>
        item.variantId === variantId
          ? { ...item, quantity: Math.min(nextQuantity, 100) }
          : item,
      ),
    )
  }

  const submitOrder = () => {
    startTransition(async () => {
      const input = {
        customerId,
        email: customerId ? undefined : email,
        status,
        items,
      }
      if (isDraft) {
        const result = await createDraftOrderAction(input)
        if (!("draftId" in result)) {
          toast.error(result.message)
          return
        }
        toast.success(`Draft order #${result.number} created.`)
        router.replace("/dashboard/orders/drafts")
        router.refresh()
        return
      }

      const result = await createOrderAction(input)
      if (!("orderId" in result)) {
        toast.error(result.message)
        return
      }
      toast.success(`Order #${result.number} created.`)
      router.replace(`/dashboard/orders/${result.orderId}`)
      router.refresh()
    })
  }

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset>
          <main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-5">
            <form className="w-full" onSubmit={(event) => { event.preventDefault(); submitOrder() }}>
              <header className="flex flex-wrap items-center justify-between gap-3">
                <div><Link href={listPath} className="text-xs font-medium text-black/55 transition hover:text-black hover:underline">{isDraft ? "Drafts" : "Orders"}</Link><h1 className="mt-1 flex items-center gap-1.5 text-lg font-semibold"><ClipboardPenLine className="size-4" /><ChevronRight className="size-4 text-black/45" />Create {recordLabel}</h1></div>
                <div className="flex items-center gap-2"><Link href={listPath} className="inline-flex h-9 items-center rounded-lg bg-black/[0.06] px-3 text-sm font-medium transition hover:bg-black/10">Discard</Link><button type="submit" disabled={isPending || !items.length || (!customerId && !email.trim())} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-3 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/30">{isPending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}Create {recordLabel}</button></div>
              </header>

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4"><Card title="Products" action={<button type="button" onClick={() => setPickerOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-black/15 px-3 text-xs font-medium transition hover:bg-black/[0.03]"><PackagePlus className="size-3.5" /> Add product</button>}>{items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] border-collapse text-left text-sm"><thead className="text-xs text-black/55"><tr><th className="border-b border-black/10 pb-2 font-medium">Product</th><th className="border-b border-black/10 pb-2 text-center font-medium">Quantity</th><th className="border-b border-black/10 pb-2 text-right font-medium">Total</th><th className="w-9 border-b border-black/10 pb-2" /></tr></thead><tbody>{items.map((item) => { const variant = variantsById.get(item.variantId); if (!variant) return null; const label = variant.title === "Default" ? variant.productTitle : `${variant.productTitle} · ${variant.title}`; return <tr key={item.variantId}><td className="border-b border-black/10 py-3"><p className="font-medium">{label}</p><p className="mt-1 font-mono text-xs text-black/50">{variant.sku} · {money(variant.price)}</p></td><td className="border-b border-black/10 py-3"><div className="mx-auto flex h-8 w-24 items-center overflow-hidden rounded-lg border border-black/15"><button type="button" onClick={() => updateQuantity(item.variantId, item.quantity - 1)} className="grid h-full w-8 place-items-center transition hover:bg-black/[0.04]" aria-label={`Decrease ${label} quantity`}><Minus className="size-3.5" /></button><input value={item.quantity} onChange={(event) => updateQuantity(item.variantId, Number(event.target.value))} inputMode="numeric" aria-label={`${label} quantity`} className="h-full min-w-0 flex-1 text-center text-sm outline-none" /><button type="button" onClick={() => updateQuantity(item.variantId, item.quantity + 1)} className="grid h-full w-8 place-items-center transition hover:bg-black/[0.04]" aria-label={`Increase ${label} quantity`}><Plus className="size-3.5" /></button></div></td><td className="border-b border-black/10 py-3 text-right font-medium">{money(variant.price * item.quantity)}</td><td className="border-b border-black/10 py-3 text-right"><button type="button" onClick={() => setItems((current) => current.filter((line) => line.variantId !== item.variantId))} aria-label={`Remove ${label}`} className="grid size-7 place-items-center rounded-md text-black/45 transition hover:bg-red-50 hover:text-red-600"><Trash2 className="size-3.5" /></button></td></tr> })}</tbody></table></div> : <button type="button" onClick={() => setPickerOpen(true)} className="flex min-h-32 w-full flex-col items-center justify-center rounded-lg border border-dashed border-black/20 text-center transition hover:bg-black/[0.02]"><PackagePlus className="size-6 text-black/45" /><span className="mt-2 text-sm font-medium">Add products to this order</span><span className="mt-1 text-xs text-black/55">Choose from your catalog.</span></button>}<div className="ml-auto mt-4 max-w-xs space-y-2 border-t border-black/10 pt-3 text-sm"><div className="flex justify-between"><span className="text-black/60">Subtotal</span><span>{money(subtotal)}</span></div><div className="flex justify-between font-semibold"><span>Total</span><span>{money(subtotal)}</span></div></div></Card></div>
                <aside className="space-y-4"><Card title="Customer"><label className="relative block"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-black/45" /><input value={customerQuery} onChange={(event) => { setCustomerQuery(event.target.value); if (customerId) setCustomerId(null) }} placeholder="Search customers" aria-label="Search customers" className="h-10 w-full rounded-lg border border-black/20 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10" /></label>{selectedCustomer ? <div className="mt-3 flex items-center justify-between rounded-lg border border-black/10 bg-black/[0.02] p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{selectedCustomer.name}</p><p className="mt-1 truncate text-xs text-black/55">{selectedCustomer.email}</p></div><button type="button" onClick={() => { setCustomerId(null); setCustomerQuery("") }} className="grid size-7 place-items-center rounded-md text-black/55 transition hover:bg-black/[0.06]" aria-label="Remove selected customer"><X className="size-4" /></button></div> : customerQuery.trim() ? <div className="mt-2 overflow-hidden rounded-lg border border-black/10">{visibleCustomers.length ? visibleCustomers.map((customer) => <button key={customer.id} type="button" onClick={() => { setCustomerId(customer.id); setCustomerQuery("") }} className="block w-full border-b border-black/10 px-3 py-2.5 text-left text-sm transition last:border-b-0 hover:bg-black/[0.03]"><span className="block font-medium">{customer.name}</span><span className="mt-1 block text-xs text-black/55">{customer.email}</span></button>) : <p className="px-3 py-3 text-xs text-black/55">No matching customers.</p>}</div> : null}<label className="mt-4 grid gap-1.5 text-sm font-medium">Guest email <input value={email} disabled={Boolean(selectedCustomer)} onChange={(event) => setEmail(event.target.value)} type="email" placeholder={selectedCustomer ? selectedCustomer.email : "customer@example.com"} className="h-10 rounded-lg border border-black/20 bg-white px-3 text-sm font-normal outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 disabled:cursor-not-allowed disabled:bg-black/[0.03]" /></label><p className="mt-2 text-xs text-black/55">Select an existing customer or enter an email for a guest {recordLabel}.</p></Card>{isDraft ? <Card title="Draft"><p className="text-sm font-medium">Save now, complete later.</p><p className="mt-2 text-xs leading-5 text-black/55">You can send the draft to the customer or convert it into a pending order from the Drafts dashboard.</p></Card> : <Card title="Payment"><label className="grid gap-1.5 text-sm font-medium">Payment status<Select value={status} onValueChange={(value) => setStatus(value as "PENDING" | "CONFIRMED")}><SelectTrigger className="h-10 rounded-lg border-black/20 bg-white px-3 text-sm font-normal shadow-none"><SelectValue /></SelectTrigger><SelectContent position="popper"><SelectItem value="PENDING">Payment pending</SelectItem><SelectItem value="CONFIRMED">Paid</SelectItem></SelectContent></Select></label><p className="mt-2 text-xs text-black/55">Paid orders can be marked as fulfilled from the Orders dashboard.</p></Card>}<Card title="Market"><div className="flex items-center justify-between text-sm"><span className="text-black/65">Currency</span><span className="font-medium">INR · Indian Rupee</span></div></Card></aside>
              </div>
            </form>

            <Dialog open={pickerOpen} onOpenChange={setPickerOpen}><DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:!w-[760px] sm:!max-w-[760px]" overlayClassName="bg-black/45 supports-backdrop-filter:backdrop-blur-[1px]"><DialogHeader className="border-b border-black/10 px-5 py-4"><DialogTitle>Select products</DialogTitle><DialogDescription>Add product variants from your catalog.</DialogDescription></DialogHeader><div className="border-b border-black/10 px-5 py-3"><label className="flex h-10 items-center gap-2 rounded-lg border border-black/20 px-3 text-sm text-black/50"><Search className="size-4" /><input value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} autoFocus placeholder="Search products or SKU" aria-label="Search products" className="w-full bg-transparent outline-none" /></label></div><div className="max-h-[52vh] overflow-y-auto"><table className="w-full border-collapse text-left text-sm"><thead className="sticky top-0 bg-white text-xs text-black/55"><tr><th className="border-b border-black/10 px-5 py-2.5 font-medium">Product</th><th className="border-b border-black/10 px-5 py-2.5 text-center font-medium">On hand</th><th className="border-b border-black/10 px-5 py-2.5 text-right font-medium">Price</th><th className="border-b border-black/10 px-5 py-2.5" /></tr></thead><tbody>{pickerVariants.map((variant) => { const label = variant.title === "Default" ? variant.productTitle : `${variant.productTitle} · ${variant.title}`; return <tr key={variant.id} className="transition hover:bg-black/[0.02]"><td className="border-b border-black/10 px-5 py-3"><p className="font-medium">{label}</p><p className="mt-1 font-mono text-xs text-black/50">{variant.sku}</p></td><td className="border-b border-black/10 px-5 py-3 text-center text-black/65">{variant.inventoryQuantity}</td><td className="border-b border-black/10 px-5 py-3 text-right font-medium">{money(variant.price)}</td><td className="border-b border-black/10 px-5 py-3 text-right"><button type="button" onClick={() => addVariant(variant.id)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-black/15 px-2.5 text-xs font-medium transition hover:bg-black/[0.03]"><Plus className="size-3.5" /> Add</button></td></tr> })}</tbody></table>{!pickerVariants.length ? <p className="px-5 py-10 text-center text-sm text-black/55">No product variants match this search.</p> : null}</div><DialogFooter className="border-t border-black/10 px-5 py-3"><button type="button" onClick={() => setPickerOpen(false)} className="h-9 rounded-lg bg-black px-3 text-sm font-medium text-white transition hover:bg-black/80">Done</button></DialogFooter></DialogContent></Dialog>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
