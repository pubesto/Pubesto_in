import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight, PackageOpen, UserRound } from "lucide-react"

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { CustomerProfileActions } from "@/components/admin-dashboard/customer-profile-actions"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getCustomerForAdmin } from "@/lib/server/dal/customers"

export const metadata: Metadata = {
  title: "Customer | Pubesto Admin",
  description: "Review a Pubesto customer profile and activity.",
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-xl border border-black/10 bg-white shadow-sm ${className}`}>
      {children}
    </section>
  )
}

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
  }).format(new Date(value))
}

function statusLabel(status: "PENDING" | "CONFIRMED" | "FULFILLED" | "CANCELLED") {
  return status.charAt(0) + status.slice(1).toLowerCase()
}

export default async function CustomerDetailPage({
  params,
}: PageProps<"/dashboard/customers/[customerId]">) {
  const { customerId } = await params
  const customer = await getCustomerForAdmin(customerId)
  if (!customer) notFound()

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset>
          <main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-5">
            <div className="w-full">
              <header className="flex flex-wrap items-center justify-between gap-3">
                <div><Link href="/dashboard/customers" className="text-xs font-medium text-black/55 transition hover:text-black hover:underline">Customers</Link><h1 className="mt-1 flex items-center gap-1.5 text-lg font-semibold"><UserRound className="size-4" /><ChevronRight className="size-4 text-black/45" />{customer.name}</h1></div>
                <CustomerProfileActions customer={customer} />
              </header>

              <Card className="mt-4 overflow-hidden"><div className="grid grid-cols-1 divide-y divide-black/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0"><div className="px-4 py-4"><p className="text-sm font-medium text-black/75">Amount spent</p><p className="mt-1 text-sm font-semibold">{money(customer.amountSpent, customer.currency)}</p></div><div className="px-4 py-4"><p className="text-sm font-medium text-black/75">Orders</p><p className="mt-1 text-sm font-semibold">{customer.orderCount}</p></div><div className="px-4 py-4"><p className="text-sm font-medium text-black/75">Customer since</p><p className="mt-1 text-sm font-semibold">{formatDate(customer.createdAt)}</p></div></div></Card>

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4"><Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-black/10 px-4 py-4"><div><h2 className="text-sm font-semibold">Order history</h2><p className="mt-1 text-xs text-black/55">All orders linked to this customer profile.</p></div><Link href="/dashboard/orders/create-order" className="inline-flex h-8 items-center rounded-lg border border-black/15 px-3 text-xs font-medium transition hover:bg-black/[0.03]">Create order</Link></div>{customer.orders.length ? <div className="overflow-x-auto"><table className="w-full min-w-[550px] border-collapse text-left text-xs"><thead className="bg-black/[0.025] text-black/60"><tr><th className="border-b border-black/10 px-4 py-2.5 font-medium">Order</th><th className="border-b border-black/10 px-4 py-2.5 font-medium">Date</th><th className="border-b border-black/10 px-4 py-2.5 font-medium">Status</th><th className="border-b border-black/10 px-4 py-2.5 text-right font-medium">Total</th></tr></thead><tbody>{customer.orders.map((order) => <tr key={order.id} className="transition hover:bg-black/[0.02]"><td className="border-b border-black/10 px-4 py-3 font-medium">#{order.number}</td><td className="border-b border-black/10 px-4 py-3 text-black/65">{formatDate(order.createdAt)}</td><td className="border-b border-black/10 px-4 py-3"><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${order.status === "CANCELLED" ? "bg-red-50 text-red-700" : order.status === "FULFILLED" ? "bg-emerald-100 text-emerald-900" : "bg-black/[0.06] text-black/65"}`}>{statusLabel(order.status)}</span></td><td className="border-b border-black/10 px-4 py-3 text-right font-medium">{money(order.total, order.currency)}</td></tr>)}</tbody></table></div> : <div className="flex min-h-44 items-center justify-center px-4 text-center"><div><PackageOpen className="mx-auto size-8 text-black/35" /><p className="mt-3 text-sm font-medium">No orders yet</p><p className="mt-1 text-xs text-black/55">This customer hasn&apos;t placed an order.</p></div></div>}</Card></div>

                <aside className="space-y-4"><Card><div className="border-b border-black/10 px-4 py-4"><h2 className="text-sm font-semibold">Customer</h2></div><div className="space-y-5 px-4 py-4 text-sm"><div><h3 className="font-semibold">Contact information</h3><a href={`mailto:${customer.email}`} className="mt-2 block truncate text-[#005BD3] hover:underline">{customer.email}</a></div><div><h3 className="font-semibold">Default location</h3><p className="mt-2 text-black/65">{customer.location}</p></div><div><h3 className="font-semibold">Marketing subscriptions</h3><p className="mt-2 text-black/65">{customer.emailMarketingSubscribed ? "Subscribed to email marketing" : "Not subscribed to email marketing"}</p></div></div></Card></aside>
              </div>
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
