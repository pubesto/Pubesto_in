import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  Building2,
  ChevronRight,
  Landmark,
  Package,
  Receipt,
  ShieldCheck,
} from "lucide-react"

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { OrderDetailActions } from "@/components/admin-dashboard/order-detail-actions"
import { OrderTrackingForm } from "@/components/admin-dashboard/order-tracking-form"
import { TaxInvoiceDialog } from "@/components/admin-dashboard/tax-invoice-dialog"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getOrderForAdmin } from "@/lib/server/dal/orders"

export const metadata: Metadata = {
  title: "Order | Pubesto Admin",
  description: "Review a Pubesto order, fulfillment status, and GST tax invoice.",
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
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
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function paymentLabel(order: { status: string; paymentStatus: string; paymentMethod: string | null }) {
  if (order.paymentStatus === "REFUNDED") return "Refunded"
  if (order.status === "CANCELLED") return order.paymentStatus === "PAID" ? "Refund due" : "Voided"
  if (order.paymentStatus === "PAID") return "Paid"
  return order.paymentMethod === "COD" ? "Cash on delivery · due" : "Payment pending"
}

function fulfillmentLabel(status: "PENDING" | "CONFIRMED" | "FULFILLED" | "CANCELLED") {
  if (status === "FULFILLED") return "Fulfilled"
  if (status === "CANCELLED") return "Cancelled"
  return "Unfulfilled"
}

export default async function OrderDetailPage({
  params,
}: PageProps<"/dashboard/orders/[orderId]">) {
  const { orderId } = await params
  const order = await getOrderForAdmin(orderId)
  if (!order) notFound()

  const invoiceNumber = `INV-PUB-${String(order.number).padStart(5, "0")}`

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset>
          <main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-6 lg:p-8">
            <div className="w-full">
              {/* Header */}
              <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Link
                    href="/dashboard/orders"
                    className="text-xs font-medium text-black/55 transition hover:text-black hover:underline"
                  >
                    Orders
                  </Link>
                  <h1 className="mt-1 flex items-center gap-1.5 text-lg font-semibold text-black">
                    <Package className="size-4" />
                    <ChevronRight className="size-4 text-black/45" />
                    Order {order.reference}
                  </h1>
                  {order.source === "SHOPIFY" ? (
                    <p className="mt-0.5 text-xs text-black/50">Imported from the previous Shopify store</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <TaxInvoiceDialog
                    order={order}
                    buttonVariant="header"
                    buttonLabel="Tax Invoice"
                  />
                  <OrderDetailActions order={order} />
                </div>
              </header>

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                {/* Left Main Column */}
                <div className="space-y-4">
                  {/* Items Card */}
                  <Card>
                    <div className="border-b border-black/10 px-5 py-4">
                      <h2 className="text-sm font-semibold text-black">Order Items</h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                        <thead className="bg-black/[0.025] text-xs text-black/60">
                          <tr>
                            <th className="border-b border-black/10 px-4 py-2.5 font-medium">
                              Product
                            </th>
                            <th className="border-b border-black/10 px-4 py-2.5 text-center font-medium">
                              Quantity
                            </th>
                            <th className="border-b border-black/10 px-4 py-2.5 text-right font-medium">
                              Price
                            </th>
                            <th className="border-b border-black/10 px-4 py-2.5 text-right font-medium">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.items.map((item) => (
                            <tr key={item.id}>
                              <td className="border-b border-black/10 px-4 py-3">
                                <p className="font-medium text-black">{item.title}</p>
                                <p className="mt-0.5 font-mono text-xs text-black/50">
                                  {item.sku}
                                </p>
                              </td>
                              <td className="border-b border-black/10 px-4 py-3 text-center">
                                {item.quantity}
                              </td>
                              <td className="border-b border-black/10 px-4 py-3 text-right">
                                {money(item.unitPrice, order.currency)}
                              </td>
                              <td className="border-b border-black/10 px-4 py-3 text-right font-medium">
                                {money(item.total, order.currency)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="ml-auto max-w-xs space-y-2 px-5 py-4 text-sm">
                      <div className="flex justify-between text-black/65">
                        <span>Subtotal</span>
                        <span>{money(order.subtotal, order.currency)}</span>
                      </div>
                      <div className="flex justify-between text-black/65">
                        <span>Discount</span>
                        <span>{money(order.discount, order.currency)}</span>
                      </div>
                      <div className="flex justify-between text-black/65">
                        <span>Shipping</span>
                        <span>{money(order.shipping, order.currency)}</span>
                      </div>
                      <div className="flex justify-between border-t border-black/10 pt-2 font-semibold">
                        <span>Total</span>
                        <span>{money(order.total, order.currency)}</span>
                      </div>
                    </div>
                  </Card>

                  {/* GST & TAX SECTION */}
                  <Card>
                    <div className="flex flex-col gap-2 border-b border-black/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Receipt className="size-4" />
                        </div>
                        <div>
                          <h2 className="text-sm font-semibold text-black">
                            GST &amp; Tax Section
                          </h2>
                          <p className="text-xs text-black/55">
                            Comprehensive tax breakdown, HSN compliance, and invoice generation.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            order.isIntraState
                              ? "bg-blue-50 text-blue-800 border border-blue-200"
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {order.isIntraState
                            ? "Intra-State (CGST + SGST)"
                            : "Inter-State (IGST)"}
                        </span>
                        <TaxInvoiceDialog
                          order={order}
                          buttonVariant="default"
                          buttonLabel="View Invoice"
                        />
                      </div>
                    </div>

                    <div className="p-5">
                      {/* KPI stats */}
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-lg border border-black/10 bg-neutral-50/70 p-3">
                          <span className="text-[11px] font-medium text-black/50">
                            Taxable Value
                          </span>
                          <p className="mt-1 font-mono text-sm font-bold text-black">
                            {money(order.taxableAmount, order.currency)}
                          </p>
                        </div>

                        {order.isIntraState ? (
                          <>
                            <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                              <span className="text-[11px] font-medium text-blue-900/70">
                                CGST (Central)
                              </span>
                              <p className="mt-1 font-mono text-sm font-bold text-blue-800">
                                {money(order.cgst, order.currency)}
                              </p>
                            </div>
                            <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                              <span className="text-[11px] font-medium text-blue-900/70">
                                SGST (State)
                              </span>
                              <p className="mt-1 font-mono text-sm font-bold text-blue-800">
                                {money(order.sgst, order.currency)}
                              </p>
                            </div>
                          </>
                        ) : (
                          <div className="col-span-2 rounded-lg border border-amber-100 bg-amber-50/40 p-3">
                            <span className="text-[11px] font-medium text-amber-900/70">
                              IGST (Integrated Tax)
                            </span>
                            <p className="mt-1 font-mono text-sm font-bold text-amber-800">
                              {money(order.igst, order.currency)}
                            </p>
                          </div>
                        )}

                        <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
                          <span className="text-[11px] font-medium text-emerald-900/70">
                            Total GST Collected
                          </span>
                          <p className="mt-1 font-mono text-sm font-bold text-emerald-800">
                            {money(order.tax, order.currency)}
                          </p>
                        </div>
                      </div>

                      {/* Store GST Metadata */}
                      <div className="mt-4 grid grid-cols-1 gap-2 rounded-lg border border-black/10 bg-neutral-50/50 p-3 text-xs sm:grid-cols-3">
                        <div>
                          <span className="text-black/50">Origin State:</span>
                          <p className="font-semibold text-black">{order.originState}</p>
                        </div>
                        <div>
                          <span className="text-black/50">Place of Supply (Destination):</span>
                          <p className="font-semibold text-black">
                            {order.destinationState}
                          </p>
                        </div>
                        <div>
                          <span className="text-black/50">Seller GSTIN:</span>
                          <p className="font-mono font-semibold text-black">
                            {order.gstin || "Not set — add it in Taxes & GST"}
                          </p>
                        </div>
                      </div>

                      {/* Line Item Tax Breakdown Table */}
                      <div className="mt-5">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-black">
                          Itemized GST &amp; HSN Breakdown
                        </h3>
                        <div className="mt-2 overflow-x-auto rounded-lg border border-black/10">
                          <table className="w-full border-collapse text-left text-xs">
                            <thead className="bg-black/[0.03] text-black/60">
                              <tr>
                                <th className="px-3 py-2 font-medium">Product</th>
                                <th className="px-3 py-2 font-mono text-center font-medium">
                                  HSN
                                </th>
                                <th className="px-3 py-2 text-center font-medium">Slab</th>
                                <th className="px-3 py-2 text-right font-medium">
                                  Taxable Value
                                </th>
                                {order.isIntraState ? (
                                  <>
                                    <th className="px-3 py-2 text-right font-medium">CGST</th>
                                    <th className="px-3 py-2 text-right font-medium">SGST</th>
                                  </>
                                ) : (
                                  <th className="px-3 py-2 text-right font-medium">IGST</th>
                                )}
                                <th className="px-3 py-2 text-right font-medium">
                                  Total GST
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5">
                              {order.items.map((item) => (
                                <tr key={item.id} className="hover:bg-black/[0.015]">
                                  <td className="px-3 py-2.5 font-medium text-black">
                                    {item.title}
                                  </td>
                                  <td className="px-3 py-2.5 text-center font-mono text-black/65">
                                    {item.hsnCode}
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <span className="rounded bg-black/[0.05] px-1.5 py-0.5 text-[10px] font-semibold">
                                      {item.taxRate}%
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-mono">
                                    {money(item.taxableAmount, order.currency)}
                                  </td>
                                  {order.isIntraState ? (
                                    <>
                                      <td className="px-3 py-2.5 text-right font-mono text-blue-700">
                                        {money(item.cgst, order.currency)}
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-mono text-blue-700">
                                        {money(item.sgst, order.currency)}
                                      </td>
                                    </>
                                  ) : (
                                    <td className="px-3 py-2.5 text-right font-mono text-amber-700">
                                      {money(item.igst, order.currency)}
                                    </td>
                                  )}
                                  <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-800">
                                    {money(item.tax, order.currency)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Right Aside */}
                <aside className="space-y-4">
                  {/* Invoice Quick Card */}
                  <Card>
                    <div className="border-b border-black/10 px-5 py-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-black">Tax Invoice</h2>
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                          <ShieldCheck className="size-3.5" />
                          <span>Generated</span>
                        </span>
                      </div>
                    </div>
                    <div className="p-5 text-xs">
                      <div className="rounded-lg border border-black/10 bg-neutral-50 p-3">
                        <span className="text-black/50">Invoice Number:</span>
                        <p className="mt-0.5 font-mono text-sm font-bold text-black">
                          {invoiceNumber}
                        </p>
                        <p className="mt-1 text-[11px] text-black/55">
                          Issued on {formatDate(order.createdAt)}
                        </p>
                      </div>

                      <div className="mt-3 space-y-1.5 text-black/70">
                        <div className="flex justify-between">
                          <span>Place of Supply:</span>
                          <span className="font-semibold text-black">
                            {order.destinationState}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>GST Included:</span>
                          <span className="font-mono font-semibold text-emerald-800">
                            {money(order.tax, order.currency)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4">
                        <TaxInvoiceDialog
                          order={order}
                          buttonVariant="default"
                          buttonLabel="View / Print Invoice"
                          className="w-full justify-center py-2.5"
                        />
                      </div>
                    </div>
                  </Card>

                  {/* Order Status Card */}
                  <Card>
                    <div className="border-b border-black/10 px-5 py-4">
                      <h2 className="text-sm font-semibold text-black">Order Status</h2>
                    </div>
                    <dl className="space-y-4 px-5 py-4 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-black/60">Payment</dt>
                        <dd className="font-medium text-black">
                          {paymentLabel(order)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-black/60">Method</dt>
                        <dd className="font-medium text-black uppercase text-xs">
                          {order.paymentMethod?.toLowerCase().includes("razorpay")
                            ? "Razorpay Live"
                            : order.paymentMethod === "cod" || order.paymentMethod === "COD"
                            ? "Cash on Delivery (COD)"
                            : order.paymentMethod || "Standard"}
                        </dd>
                      </div>
                      {order.paymentDetails?.razorpayPaymentId && (
                        <div className="flex flex-col gap-1 border-t border-black/5 pt-2 text-xs">
                          <dt className="text-black/50">Razorpay Payment ID</dt>
                          <dd className="font-mono font-medium text-emerald-800 break-all">
                            {order.paymentDetails.razorpayPaymentId}
                          </dd>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-black/60">Fulfillment</dt>
                        <dd className="font-medium text-black">
                          {fulfillmentLabel(order.status)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-black/60">Created</dt>
                        <dd className="text-right font-medium text-black">
                          {formatDate(order.createdAt)}
                        </dd>
                      </div>
                    </dl>
                  </Card>

                  {order.status === "CANCELLED" && order.cancelReason ? (
                    <Card>
                      <div className="px-5 py-4 text-sm">
                        <h2 className="font-semibold text-black">Cancellation</h2>
                        <p className="mt-1 text-black/70">{order.cancelReason}</p>
                        {order.paymentStatus === "PAID" ? (
                          <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                            Paid online — refund it from the Razorpay dashboard.
                          </p>
                        ) : null}
                      </div>
                    </Card>
                  ) : null}

                  {order.status !== "CANCELLED" ? <OrderTrackingForm order={order} /> : null}

                  {order.customerNote || order.discountCode ? (
                    <Card>
                      <dl className="space-y-2 px-5 py-4 text-sm">
                        {order.discountCode ? (
                          <div className="flex justify-between gap-3">
                            <dt className="text-black/60">Discount code</dt>
                            <dd className="font-mono font-medium">{order.discountCode}</dd>
                          </div>
                        ) : null}
                        {order.customerNote ? (
                          <div>
                            <dt className="text-black/60">Note from customer</dt>
                            <dd className="mt-1 whitespace-pre-line text-black">{order.customerNote}</dd>
                          </div>
                        ) : null}
                      </dl>
                    </Card>
                  ) : null}

                  {/* Customer Card */}
                  <Card>
                    <div className="border-b border-black/10 px-5 py-4">
                      <h2 className="text-sm font-semibold text-black">Customer Details</h2>
                    </div>
                    <div className="px-5 py-4 text-sm">
                      {order.customer ? (
                        <>
                          <Link
                            href={`/dashboard/customers/${order.customer.id}`}
                            className="font-semibold text-[#0c3152] hover:underline"
                          >
                            {order.customer.name}
                          </Link>
                          <a
                            href={`mailto:${order.email}`}
                            className="mt-1.5 block text-xs text-black/60 hover:underline"
                          >
                            {order.email}
                          </a>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold text-black">Guest Customer</p>
                          <a
                            href={`mailto:${order.email}`}
                            className="mt-1.5 block text-xs text-black/60 hover:underline"
                          >
                            {order.email}
                          </a>
                        </>
                      )}

                      {order.shippingAddress && (
                        <div className="mt-3 border-t border-black/10 pt-3 text-xs text-black/70">
                          <p className="font-semibold text-black">Shipping Address:</p>
                          <p className="mt-1 leading-relaxed">
                            {[
                              order.shippingAddress.address1,
                              order.shippingAddress.address2,
                              order.shippingAddress.city,
                              order.shippingAddress.state,
                              order.shippingAddress.postalCode,
                              order.shippingAddress.country,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                          {order.shippingAddress.phone && (
                            <p className="mt-1 text-black/60">
                              Phone: {order.shippingAddress.phone}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                </aside>
              </div>
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
