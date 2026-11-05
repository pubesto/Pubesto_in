import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight, ShoppingCart } from "lucide-react"

import { AbandonedCheckoutActions } from "@/components/admin-dashboard/abandoned-checkout-actions"
import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getAbandonedCheckoutForAdmin } from "@/lib/server/dal/abandoned-checkouts"

export const metadata: Metadata = {
  title: "Abandoned checkout | Pubesto Admin",
  description: "View and recover an abandoned Pubesto checkout.",
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">{children}</section>
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value))
}

export default async function AbandonedCheckoutDetailPage({
  params,
}: PageProps<"/dashboard/orders/abandoned-checkouts/[checkoutId]">) {
  const { checkoutId } = await params
  const checkout = await getAbandonedCheckoutForAdmin(checkoutId)
  if (!checkout) notFound()

  return <TooltipProvider><SidebarProvider className="min-h-svh"><AppSidebar /><SidebarInset><main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-5"><div className="w-full"><header className="flex flex-wrap items-center justify-between gap-3"><div><Link href="/dashboard/orders/abandoned-checkouts" className="text-xs font-medium text-black/55 transition hover:text-black hover:underline">Abandoned checkouts</Link><h1 className="mt-1 flex items-center gap-1.5 text-lg font-semibold"><ShoppingCart className="size-4" /><ChevronRight className="size-4 text-black/45" />Checkout #{checkout.id.slice(-10).toUpperCase()}</h1></div><AbandonedCheckoutActions checkoutId={checkout.id} /></header><div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]"><div className="space-y-4"><Card><div className="border-b border-black/10 px-4 py-4"><h2 className="text-sm font-semibold">Cart items</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[560px] border-collapse text-left text-sm"><thead className="bg-black/[0.025] text-xs text-black/60"><tr><th className="border-b border-black/10 px-4 py-2.5 font-medium">Product</th><th className="border-b border-black/10 px-4 py-2.5 text-center font-medium">Quantity</th><th className="border-b border-black/10 px-4 py-2.5 text-right font-medium">Price</th><th className="border-b border-black/10 px-4 py-2.5 text-right font-medium">Total</th></tr></thead><tbody>{checkout.items.map((item) => <tr key={item.id}><td className="border-b border-black/10 px-4 py-3"><p className="font-medium">{item.title}</p><p className="mt-1 font-mono text-xs text-black/50">{item.sku}</p></td><td className="border-b border-black/10 px-4 py-3 text-center">{item.quantity}</td><td className="border-b border-black/10 px-4 py-3 text-right">{money(item.unitPrice, checkout.currency)}</td><td className="border-b border-black/10 px-4 py-3 text-right font-medium">{money(item.total, checkout.currency)}</td></tr>)}</tbody></table></div><div className="ml-auto max-w-xs px-4 py-4 text-sm"><div className="flex justify-between border-t border-black/10 pt-2 font-semibold"><span>Total</span><span>{money(checkout.total, checkout.currency)}</span></div></div></Card></div><aside className="space-y-4"><Card><div className="border-b border-black/10 px-4 py-4"><h2 className="text-sm font-semibold">Checkout status</h2></div><dl className="space-y-4 px-4 py-4 text-sm"><div className="flex items-center justify-between gap-3"><dt className="text-black/60">Recovery</dt><dd><span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-900">Open</span></dd></div><div className="flex items-center justify-between gap-3"><dt className="text-black/60">Last updated</dt><dd className="text-right font-medium">{formatDate(checkout.updatedAt)}</dd></div></dl></Card><Card><div className="border-b border-black/10 px-4 py-4"><h2 className="text-sm font-semibold">Customer</h2></div><div className="px-4 py-4 text-sm"><Link href={`/dashboard/customers/${checkout.customer.id}`} className="font-semibold text-[#0c3152] hover:underline">{checkout.customer.name}</Link><a href={`mailto:${checkout.customer.email}`} className="mt-2 block text-black/60 hover:underline">{checkout.customer.email}</a></div></Card></aside></div></div></main></SidebarInset></SidebarProvider></TooltipProvider>
}
