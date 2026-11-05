"use client"

import { useState } from "react"
import {
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Layers,
  Printer,
  Receipt,
  X,
} from "lucide-react"

import type { AdminOrderDetail } from "@/lib/server/dal/orders"
import type { MonthlyGstOrder, MonthlyGstOrderItem } from "@/lib/taxes"
import { numberToWordsINR } from "@/lib/taxes"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export type InvoiceLikeOrder = {
  id: string
  number: number
  createdAt: string
  customer?: { id?: string; name: string } | null
  customerName?: string
  email: string
  currency?: string
  total: number
  subtotal?: number
  discount?: number
  shipping?: number
  tax?: number
  totalGst?: number
  cgst: number
  sgst: number
  igst: number
  taxableAmount: number
  isIntraState: boolean
  destinationState?: string
  state?: string
  originState?: string
  gstin?: string
  taxSettings?: { legalName?: string; businessAddress?: string }
  shippingAddress?: {
    name?: string
    address1?: string
    address2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
    phone?: string
  } | null
  items: Array<{
    id: string
    title: string
    sku: string
    quantity: number
    unitPrice: number
    total: number
    taxRate: number
    tax?: number
    hsnCode: string
    taxableAmount: number
    cgst: number
    sgst: number
    igst: number
  }>
}

function formatMoney(amount: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(dateStr))
}

export function exportInvoicesCsv(
  orders: InvoiceLikeOrder[],
  filename = "pubesto-tax-invoices.csv",
  defaultOrigin = "Delhi",
  defaultGstin = "",
) {
  const headers = [
    "Invoice No",
    "Invoice Date",
    "Order No",
    "Customer Name",
    "Customer Email",
    "Origin State",
    "Destination State",
    "Supply Type",
    "Taxable Value (INR)",
    "CGST (INR)",
    "SGST (INR)",
    "IGST (INR)",
    "Total Tax (INR)",
    "Total Invoice Value (INR)",
  ]

  const rows = orders.map((o) => {
    const invNo = `INV-PUB-${String(o.number).padStart(5, "0")}`
    const dest = o.destinationState || o.state || defaultOrigin
    const isIntra = o.isIntraState
    const totalTax = Number(o.tax ?? o.totalGst ?? 0)
    const custName = o.customer?.name || o.customerName || "Customer"

    return [
      `"${invNo}"`,
      `"${formatDate(o.createdAt)}"`,
      `"#${o.number}"`,
      `"${custName.replace(/"/g, '""')}"`,
      `"${o.email}"`,
      `"${o.originState || defaultOrigin}"`,
      `"${dest}"`,
      `"${isIntra ? "Intra-State" : "Inter-State"}"`,
      o.taxableAmount.toFixed(2),
      o.cgst.toFixed(2),
      o.sgst.toFixed(2),
      o.igst.toFixed(2),
      totalTax.toFixed(2),
      o.total.toFixed(2),
    ]
  })

  const csvContent =
    "data:text/csv;charset=utf-8," +
    [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")

  const encodedUri = encodeURI(csvContent)
  const link = document.createElement("a")
  link.setAttribute("href", encodedUri)
  link.setAttribute("download", filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Single Tax Invoice printable sheet
 */
export function TaxInvoiceSheet({
  order,
  defaultOrigin = "Delhi",
  defaultGstin = "",
}: {
  order: InvoiceLikeOrder
  defaultOrigin?: string
  defaultGstin?: string
}) {
  const invoiceNumber = `INV-PUB-${String(order.number).padStart(5, "0")}`
  const invoiceDate = formatDate(order.createdAt)
  const originState = order.originState || defaultOrigin
  const gstin = order.gstin || defaultGstin
  const destinationState = order.destinationState || order.state || defaultOrigin
  const customerName = order.customer?.name || order.customerName || "Customer"
  const totalTax = Number(order.tax ?? order.totalGst ?? 0)

  // Aggregate taxes by HSN
  const hsnMap = new Map<
    string,
    {
      hsn: string
      taxableAmount: number
      cgst: number
      sgst: number
      igst: number
      totalTax: number
      rate: number
    }
  >()

  for (const item of order.items) {
    const existing = hsnMap.get(item.hsnCode)
    const itemTax = item.tax ?? item.cgst + item.sgst + item.igst
    if (existing) {
      existing.taxableAmount += item.taxableAmount
      existing.cgst += item.cgst
      existing.sgst += item.sgst
      existing.igst += item.igst
      existing.totalTax += itemTax
    } else {
      hsnMap.set(item.hsnCode, {
        hsn: item.hsnCode,
        taxableAmount: item.taxableAmount,
        cgst: item.cgst,
        sgst: item.sgst,
        igst: item.igst,
        totalTax: itemTax,
        rate: item.taxRate,
      })
    }
  }

  const hsnSummaries = Array.from(hsnMap.values())

  return (
    <div
      className="p-8 text-black print:p-6 bg-white border border-black/10 rounded-xl print:border-none print:rounded-none shadow-sm print:shadow-none break-after-page"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Header section */}
      <div className="border-b-2 border-black pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/favicon.png"
                alt="Pubesto"
                className="h-9 w-9 rounded object-contain print:h-9"
              />
              <div className="border-l border-black/20 pl-3 leading-tight">
                <span className="block text-sm font-bold text-black">
                  {order.taxSettings?.legalName || "Pubesto"}
                </span>
                <span className="block text-[11px] text-black/60">
                  Cooling gadgets, bottles &amp; everyday essentials
                </span>
              </div>
            </div>
            <div className="mt-3 text-xs leading-relaxed text-black/75">
              {order.taxSettings?.businessAddress ? (
                <p>
                  <span className="font-semibold">Registered Office:</span>{" "}
                  {order.taxSettings.businessAddress}
                </p>
              ) : null}
              <p>
                <span className="font-semibold">GSTIN:</span>{" "}
                <span className="font-mono font-bold text-black">{gstin}</span> &nbsp;|&nbsp;{" "}
                <span className="font-semibold">Origin State:</span> {originState}
              </p>
              <p>
                <span className="font-semibold">Email:</span> support@pubesto.com &nbsp;|&nbsp;{" "}
                <span className="font-semibold">Website:</span> www.pubesto.com
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-black/15 bg-neutral-50/70 p-4 text-right text-xs sm:min-w-[240px]">
            <span className="inline-block rounded bg-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              Tax Invoice
            </span>
            <p className="mt-0.5 text-[10px] italic text-black/60">
              (Original for Recipient)
            </p>
            <div className="mt-3 space-y-1 font-mono text-xs">
              <p>
                <span className="text-black/60">Invoice No: </span>
                <strong className="text-black">{invoiceNumber}</strong>
              </p>
              <p>
                <span className="text-black/60">Invoice Date: </span>
                <strong className="text-black">{invoiceDate}</strong>
              </p>
              <p>
                <span className="text-black/60">Order Ref: </span>
                <strong className="text-black">#{order.number}</strong>
              </p>
              <p>
                <span className="text-black/60">Place of Supply: </span>
                <strong className="text-black">{destinationState}</strong>
              </p>
              <p>
                <span className="text-black/60">Supply Type: </span>
                <strong className="text-black">
                  {order.isIntraState ? "Intra-State (CGST+SGST)" : "Inter-State (IGST)"}
                </strong>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Buyer & Consignee Details */}
      <div className="mt-5 grid grid-cols-1 gap-6 border-b border-black/15 pb-5 sm:grid-cols-2 text-xs">
        <div>
          <p className="font-semibold uppercase tracking-wider text-black/60">
            Bill To (Customer)
          </p>
          <div className="mt-1.5 space-y-0.5 font-medium text-black">
            <p className="text-sm font-bold text-black">{customerName}</p>
            <p className="text-black/75">{order.email}</p>
            {order.shippingAddress?.phone && (
              <p className="text-black/75">Phone: {order.shippingAddress.phone}</p>
            )}
            {order.shippingAddress ? (
              <p className="text-black/75">
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
            ) : (
              <p className="text-black/75">Destination: {destinationState}, India</p>
            )}
          </div>
        </div>

        <div>
          <p className="font-semibold uppercase tracking-wider text-black/60">
            Ship To (Delivery Details)
          </p>
          <div className="mt-1.5 space-y-0.5 text-black">
            <p className="text-sm font-bold text-black">
              {order.shippingAddress?.name || customerName}
            </p>
            {order.shippingAddress ? (
              <p className="text-black/75">
                {[
                  order.shippingAddress.address1,
                  order.shippingAddress.address2,
                  order.shippingAddress.city,
                  order.shippingAddress.state,
                  order.shippingAddress.postalCode,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            ) : (
              <p className="text-black/75">{destinationState}, India</p>
            )}
            <p className="mt-1">
              <span className="font-medium text-black/60">State of Supply: </span>
              <span className="font-semibold text-black">{destinationState}</span>
            </p>
            <p>
              <span className="font-medium text-black/60">Reverse Charge Applicable: </span>
              <span className="font-semibold text-black">No</span>
            </p>
          </div>
        </div>
      </div>

      {/* Itemized Goods Table */}
      <div className="mt-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-black">
          Line Items &amp; Taxable Turnover
        </h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-y-2 border-black bg-neutral-100 font-semibold text-black">
                <th className="py-2.5 pl-2 pr-1 text-center w-8">#</th>
                <th className="py-2.5 px-3">Description of Goods</th>
                <th className="py-2.5 px-2 font-mono text-center">HSN</th>
                <th className="py-2.5 px-2 text-center w-12">Qty</th>
                <th className="py-2.5 px-3 text-right">Unit MRP</th>
                <th className="py-2.5 px-3 text-right">Taxable Val</th>
                {order.isIntraState ? (
                  <>
                    <th className="py-2.5 px-2 text-right">CGST</th>
                    <th className="py-2.5 px-2 text-right">SGST</th>
                  </>
                ) : (
                  <th className="py-2.5 px-3 text-right">IGST</th>
                )}
                <th className="py-2.5 pl-3 pr-2 text-right">Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {order.items.map((item, idx) => {
                const itemTotalTax = item.tax ?? item.cgst + item.sgst + item.igst
                return (
                  <tr key={item.id || idx} className="text-black">
                    <td className="py-3 pl-2 pr-1 text-center text-black/60">{idx + 1}</td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-black">{item.title}</p>
                      <p className="font-mono text-[11px] text-black/55">SKU: {item.sku}</p>
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-black/75">
                      {item.hsnCode}
                    </td>
                    <td className="py-3 px-2 text-center font-medium">{item.quantity}</td>
                    <td className="py-3 px-3 text-right font-mono">
                      {formatMoney(item.unitPrice, order.currency)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-medium">
                      {formatMoney(item.taxableAmount, order.currency)}
                    </td>
                    {order.isIntraState ? (
                      <>
                        <td className="py-3 px-2 text-right font-mono text-blue-800">
                          <span className="text-[10px] text-black/50 block">
                            {(item.taxRate / 2).toFixed(1)}%
                          </span>
                          {formatMoney(item.cgst, order.currency)}
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-blue-800">
                          <span className="text-[10px] text-black/50 block">
                            {(item.taxRate / 2).toFixed(1)}%
                          </span>
                          {formatMoney(item.sgst, order.currency)}
                        </td>
                      </>
                    ) : (
                      <td className="py-3 px-3 text-right font-mono text-amber-800">
                        <span className="text-[10px] text-black/50 block">
                          {item.taxRate.toFixed(1)}%
                        </span>
                        {formatMoney(item.igst, order.currency)}
                      </td>
                    )}
                    <td className="py-3 pl-3 pr-2 text-right font-mono font-bold text-black">
                      {formatMoney(item.total, order.currency)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tax Summary Breakdown by HSN */}
      <div className="mt-5 border-t border-black/15 pt-4">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-black/75">
          GST Tax Summary (by HSN/SAC Code)
        </h4>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-left text-[11px]">
            <thead>
              <tr className="border-y border-black/20 bg-neutral-50 text-black/70">
                <th className="py-1.5 px-3 font-mono">HSN Code</th>
                <th className="py-1.5 px-3 text-right">Taxable Value</th>
                {order.isIntraState ? (
                  <>
                    <th className="py-1.5 px-3 text-right">CGST Amt</th>
                    <th className="py-1.5 px-3 text-right">SGST Amt</th>
                  </>
                ) : (
                  <th className="py-1.5 px-3 text-right">IGST Amt</th>
                )}
                <th className="py-1.5 px-3 text-right font-bold text-black">Total Tax</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 font-mono">
              {hsnSummaries.map((hsn) => (
                <tr key={hsn.hsn}>
                  <td className="py-1.5 px-3 font-medium text-black">{hsn.hsn}</td>
                  <td className="py-1.5 px-3 text-right">
                    {formatMoney(hsn.taxableAmount, order.currency)}
                  </td>
                  {order.isIntraState ? (
                    <>
                      <td className="py-1.5 px-3 text-right text-blue-800">
                        {formatMoney(hsn.cgst, order.currency)}
                      </td>
                      <td className="py-1.5 px-3 text-right text-blue-800">
                        {formatMoney(hsn.sgst, order.currency)}
                      </td>
                    </>
                  ) : (
                    <td className="py-1.5 px-3 text-right text-amber-800">
                      {formatMoney(hsn.igst, order.currency)}
                    </td>
                  )}
                  <td className="py-1.5 px-3 text-right font-bold text-emerald-800">
                    {formatMoney(hsn.totalTax, order.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals & Grand Summary */}
      <div className="mt-5 border-t-2 border-black pt-4">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold text-black/60 uppercase tracking-wider">
              Total Amount in Words:
            </p>
            <p className="mt-1 font-serif text-sm font-semibold italic text-black">
              {numberToWordsINR(order.total)}
            </p>

            <div className="mt-5 rounded-lg border border-black/10 bg-neutral-50 p-3 text-[11px] text-black/70">
              <p className="font-semibold text-black">Declaration &amp; Notes:</p>
              <p className="mt-1 leading-relaxed">
                1. We declare that this invoice shows the actual price of the goods described
                and that all particulars are true and correct.
              </p>
              <p className="mt-0.5 leading-relaxed">
                2. Goods are inclusive of standard GST as applicable under Indian tax laws.
              </p>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-black/75">
              <span>Gross Taxable Turnover:</span>
              <span className="font-mono font-medium">
                {formatMoney(order.taxableAmount, order.currency)}
              </span>
            </div>

            {order.isIntraState ? (
              <>
                <div className="flex justify-between text-blue-900">
                  <span>Central GST (CGST):</span>
                  <span className="font-mono font-medium">
                    {formatMoney(order.cgst, order.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-blue-900">
                  <span>State GST (SGST):</span>
                  <span className="font-mono font-medium">
                    {formatMoney(order.sgst, order.currency)}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-amber-900">
                <span>Integrated GST (IGST):</span>
                <span className="font-mono font-medium">
                  {formatMoney(order.igst, order.currency)}
                </span>
              </div>
            )}

            <div className="flex justify-between text-black/75">
              <span>Total Tax (GST):</span>
              <span className="font-mono font-semibold text-emerald-800">
                {formatMoney(totalTax, order.currency)}
              </span>
            </div>

            {(order.discount ?? 0) > 0 && (
              <div className="flex justify-between text-red-700">
                <span>Discount:</span>
                <span className="font-mono">
                  -{formatMoney(order.discount ?? 0, order.currency)}
                </span>
              </div>
            )}

            {(order.shipping ?? 0) > 0 && (
              <div className="flex justify-between text-black/75">
                <span>Shipping Charges:</span>
                <span className="font-mono">
                  {formatMoney(order.shipping ?? 0, order.currency)}
                </span>
              </div>
            )}

            <div className="flex justify-between border-t-2 border-black pt-2 text-sm font-bold text-black">
              <span>Total Payable:</span>
              <span className="font-mono text-base">
                {formatMoney(order.total, order.currency)}
              </span>
            </div>

            <div className="pt-6 text-right">
              <div className="inline-block border-t border-black/40 pt-1 text-center">
                <p className="font-mono text-xs font-bold text-black">
                  For Pubesto
                </p>
                <p className="mt-6 text-[10px] italic text-black/60">Authorized Signatory</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Individual Tax Invoice Dialog Component
 */
type TaxInvoiceDialogProps = {
  order: InvoiceLikeOrder
  buttonLabel?: string
  buttonVariant?: "default" | "outline" | "secondary" | "header" | "compact"
  className?: string
  iconOnly?: boolean
  defaultOrigin?: string
  defaultGstin?: string
}

export function TaxInvoiceDialog({
  order,
  buttonLabel = "Tax Invoice",
  buttonVariant = "outline",
  className = "",
  iconOnly = false,
  defaultOrigin = "Delhi",
  defaultGstin = "",
}: TaxInvoiceDialogProps) {
  const [open, setOpen] = useState(false)
  const invoiceNumber = `INV-PUB-${String(order.number).padStart(5, "0")}`

  const handlePrint = () => {
    window.print()
  }

  let btnClasses =
    "inline-flex cursor-pointer items-center gap-1.5 rounded-lg text-xs font-medium transition"
  if (buttonVariant === "default") {
    btnClasses += " bg-black px-3.5 py-2 text-white shadow-sm hover:bg-black/85"
  } else if (buttonVariant === "secondary") {
    btnClasses += " bg-black/[0.05] px-3 py-1.5 text-black hover:bg-black/10"
  } else if (buttonVariant === "compact") {
    btnClasses +=
      " h-7 rounded border border-black/15 bg-white px-2 text-[11px] text-black shadow-2xs hover:bg-black hover:text-white"
  } else if (buttonVariant === "header") {
    btnClasses +=
      " h-9 rounded-lg border border-black/20 bg-white px-3 text-xs font-medium text-black shadow-sm hover:bg-black/[0.04]"
  } else {
    btnClasses +=
      " border border-black/20 bg-white px-3 py-1.5 text-black shadow-sm hover:bg-black/[0.04]"
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          title={`Download or view tax invoice for Order #${order.number}`}
          className={`${btnClasses} ${className}`}
        >
          <FileText className="size-3.5" />
          {!iconOnly && <span>{buttonLabel}</span>}
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto bg-white p-0 text-black shadow-2xl print:m-0 print:max-h-none print:max-w-none print:overflow-visible print:border-none print:p-0 print:shadow-none">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="flex items-center justify-between border-b border-black/10 bg-neutral-50 px-6 py-3.5 pr-12 print:hidden">
          <div className="flex items-center gap-2">
            <Receipt className="size-4 text-emerald-700" />
            <span className="text-sm font-semibold text-black">
              Tax Invoice — {invoiceNumber}
            </span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
              GST Compliant
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-black px-3.5 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-black/80"
            >
              <Printer className="size-3.5" />
              <span>Print / Download PDF</span>
            </button>
          </div>
        </div>

        {/* Printable Sheet */}
        <div className="p-6">
          <TaxInvoiceSheet
            order={order}
            defaultOrigin={defaultOrigin}
            defaultGstin={defaultGstin}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Batch Tax Invoice Dialog Component (Order-wise download of all or multiple invoices)
 */
type BatchTaxInvoiceDialogProps = {
  orders: InvoiceLikeOrder[]
  title?: string
  buttonLabel?: string
  className?: string
  defaultOrigin?: string
  defaultGstin?: string
}

export function BatchTaxInvoiceDialog({
  orders,
  title = "Month Tax Invoices",
  buttonLabel = "Download All Invoices (Batch PDF)",
  className = "",
  defaultOrigin = "Delhi",
  defaultGstin = "",
}: BatchTaxInvoiceDialogProps) {
  const [open, setOpen] = useState(false)

  const handlePrintAll = () => {
    window.print()
  }

  const handleExportCsv = () => {
    exportInvoicesCsv(
      orders,
      `${title.toLowerCase().replace(/\s+/g, "-")}-invoices.csv`,
      defaultOrigin,
      defaultGstin,
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={!orders.length}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-black px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-black/85 disabled:cursor-not-allowed disabled:bg-black/30 ${className}`}
        >
          <Printer className="size-3.5" />
          <span>{buttonLabel}</span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto bg-neutral-100 p-0 text-black shadow-2xl print:m-0 print:max-h-none print:max-w-none print:overflow-visible print:border-none print:bg-white print:p-0 print:shadow-none">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between border-b border-black/10 bg-white px-6 py-3.5 pr-14 shadow-xs print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
              <Layers className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-black">{title}</h3>
                <span className="rounded-full bg-black/[0.06] px-2 py-0.5 font-mono text-[11px] font-semibold">
                  {orders.length} Invoices Pack
                </span>
              </div>
              <p className="text-[11px] text-black/55">
                Order-wise sequential invoices ready for multi-page PDF export or printing.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-black/20 bg-white px-3 py-1.5 text-xs font-medium text-black shadow-2xs transition hover:bg-black/[0.04]"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-700" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrintAll}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-black px-4 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-black/80"
            >
              <Printer className="size-3.5" />
              <span>Print / Save All as PDF</span>
            </button>
          </div>
        </div>

        {/* Printable batch of all invoice sheets */}
        <div className="space-y-6 p-6 print:space-y-0 print:p-0">
          {orders.map((o, idx) => (
            <div key={o.id} className="relative print:break-after-page">
              <div className="mb-2 flex items-center justify-between px-1 text-xs text-black/50 print:hidden">
                <span className="font-semibold">
                  Invoice {idx + 1} of {orders.length}
                </span>
                <span className="font-mono">
                  Order #{o.number} · INV-PUB-{String(o.number).padStart(5, "0")}
                </span>
              </div>
              <TaxInvoiceSheet
                order={o}
                defaultOrigin={defaultOrigin}
                defaultGstin={defaultGstin}
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
