"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Calculator,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Info,
  Landmark,
  Layers,
  LoaderCircle,
  Package,
  Receipt,
  Settings2,
  TrendingUp,
} from "lucide-react"
import { toast } from "sonner"

import {
  BatchTaxInvoiceDialog,
  exportInvoicesCsv,
  TaxInvoiceDialog,
} from "@/components/admin-dashboard/tax-invoice-dialog"

import {
  fetchMonthlyGstAnalyticsAction,
  updateTaxSettingsAction,
} from "@/app/actions/taxes"
import {
  calculateGst,
  GST_SLABS,
  INDIAN_STATES,
  type MonthlyGstAnalytics,
  type MonthlyGstLedgerRow,
  type TaxSettingData,
} from "@/lib/taxes"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatCurrencyCompact(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(amount)
}

const inputClass =
  "h-10 w-full rounded-lg border border-black/20 bg-white px-3 text-sm outline-none transition placeholder:text-black/40 focus:border-black focus:ring-2 focus:ring-black/10"

type TaxesManagerProps = {
  initialAnalytics: MonthlyGstAnalytics
}

export function TaxesManager({ initialAnalytics }: TaxesManagerProps) {
  const [analytics, setAnalytics] = useState<MonthlyGstAnalytics>(initialAnalytics)
  const [selectedYear, setSelectedYear] = useState<number>(initialAnalytics.year)
  const [activeTab, setActiveTab] = useState<"reports" | "calculator" | "settings">("reports")
  const [inspectedMonth, setInspectedMonth] = useState<MonthlyGstLedgerRow | null>(null)
  const [inspectorTab, setInspectorTab] = useState<"orders" | "states" | "products">("orders")
  const [selectedMonthOrderIds, setSelectedMonthOrderIds] = useState<string[]>([])

  // Settings form state
  const [settingsForm, setSettingsForm] = useState<TaxSettingData>(initialAnalytics.settings)
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false)

  // Live Calculator state
  const [calcPrice, setCalcPrice] = useState<string>("2990")
  const [calcRate, setCalcRate] = useState<number>(initialAnalytics.settings.defaultGstRate || 12)
  const [calcIsIntraState, setCalcIsIntraState] = useState<boolean>(true)
  const [calcIsInclusive, setCalcIsInclusive] = useState<boolean>(
    initialAnalytics.settings.priceInclusive
  )

  const [isPending, startTransition] = useTransition()

  // Handle year change
  const handleYearChange = (yearStr: string) => {
    const year = Number(yearStr)
    setSelectedYear(year)
    startTransition(async () => {
      const res = await fetchMonthlyGstAnalyticsAction(year)
      if (res.success && res.data) {
        setAnalytics(res.data)
      } else {
        toast.error(res.error || "Failed to load GST analytics")
      }
    })
  }

  // Handle settings save
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdatingSettings(true)
    try {
      const res = await updateTaxSettingsAction({
        originState: settingsForm.originState,
        gstin: settingsForm.gstin,
        defaultGstRate: Number(settingsForm.defaultGstRate),
        priceInclusive: settingsForm.priceInclusive,
        defaultHsn: settingsForm.defaultHsn,
        legalName: settingsForm.legalName,
        businessAddress: settingsForm.businessAddress,
      })
      if (res.success && res.data) {
        setSettingsForm(res.data)
        setAnalytics((prev) => ({ ...prev, settings: res.data! }))
        toast.success("Tax & GST settings saved successfully.")
      } else {
        toast.error(res.error || "Failed to update tax settings.")
      }
    } catch {
      toast.error("An error occurred while saving tax settings.")
    } finally {
      setIsUpdatingSettings(false)
    }
  }

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
      "Month",
      "Year",
      "Orders Count",
      "Gross Sales (INR)",
      "Taxable Value (INR)",
      "CGST (INR)",
      "SGST (INR)",
      "IGST (INR)",
      "Total GST (INR)",
    ]

    const rows = analytics.monthlyLedger.map((row) => [
      `"${row.monthName}"`,
      row.year,
      row.orderCount,
      row.grossSales.toFixed(2),
      row.taxableSales.toFixed(2),
      row.cgst.toFixed(2),
      row.sgst.toFixed(2),
      row.igst.toFixed(2),
      row.totalGst.toFixed(2),
    ])

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n")

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `pubesto-monthly-gst-report-${selectedYear}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`Exported ${selectedYear} GST Ledger CSV`)
  }

  // Calculator preview calculations
  const parsedPrice = parseFloat(calcPrice) || 0
  const calcResult = calculateGst(
    parsedPrice,
    calcRate,
    calcIsInclusive,
    settingsForm.originState,
    calcIsIntraState ? settingsForm.originState : "Different State"
  )

  // Chart data formatting
  const chartData = analytics.monthlyLedger.map((m) => ({
    name: m.monthName.split(" ")[0].slice(0, 3),
    fullName: m.monthName,
    Taxable: m.taxableSales,
    CGST: m.cgst,
    SGST: m.sgst,
    IGST: m.igst,
    TotalGST: m.totalGst,
  }))

  return (
    <main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-6 lg:p-8">
      {/* Header bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-black/50">
            <Landmark className="size-3.5" />
            <span>Store Taxation & Compliance</span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-black sm:text-2xl">
            Taxes &amp; GST Management
          </h1>
          <p className="mt-0.5 text-xs text-black/60 sm:text-sm">
            Manage GST/IGST pricing slabs, origin state tax policies, and track monthly tax generation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Year selector */}
          <div className="flex items-center gap-1.5 rounded-lg border border-black/15 bg-white px-2.5 py-1 text-xs">
            <span className="text-black/50 font-medium">Fiscal Year:</span>
            <Select value={String(selectedYear)} onValueChange={handleYearChange}>
              <SelectTrigger className="h-7 w-20 border-none bg-transparent p-0 font-semibold shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {analytics.availableYears.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Export CSV button */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-black/15 bg-white px-3 text-xs font-medium text-black shadow-sm transition hover:bg-black/[0.04]"
          >
            <Download className="size-3.5" />
            <span>Export GSTR CSV</span>
          </button>
        </div>
      </div>

      {/* Top Metric KPI Cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-black/55">
            <span>Total GST</span>
            <Receipt className="size-3.5 text-black/40" />
          </div>
          <div className="mt-2 text-lg font-bold text-black sm:text-xl">
            {formatCurrency(analytics.summary.totalGst)}
          </div>
          <div className="mt-1 text-[11px] font-medium text-emerald-700">
            From {analytics.summary.orderCount} orders
          </div>
        </div>

        <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-black/55">
            <span>CGST (Central)</span>
            <span className="rounded bg-blue-50 px-1 py-0.5 text-[10px] font-medium text-blue-700">
              Intra-State
            </span>
          </div>
          <div className="mt-2 text-lg font-bold text-black sm:text-xl">
            {formatCurrency(analytics.summary.totalCgst)}
          </div>
          <div className="mt-1 text-[11px] text-black/50">
            State origin: {settingsForm.originState}
          </div>
        </div>

        <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-black/55">
            <span>SGST (State)</span>
            <span className="rounded bg-blue-50 px-1 py-0.5 text-[10px] font-medium text-blue-700">
              Intra-State
            </span>
          </div>
          <div className="mt-2 text-lg font-bold text-black sm:text-xl">
            {formatCurrency(analytics.summary.totalSgst)}
          </div>
          <div className="mt-1 text-[11px] text-black/50">
            50% of local GST
          </div>
        </div>

        <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-black/55">
            <span>IGST (Integrated)</span>
            <span className="rounded bg-amber-50 px-1 py-0.5 text-[10px] font-medium text-amber-700">
              Inter-State
            </span>
          </div>
          <div className="mt-2 text-lg font-bold text-black sm:text-xl">
            {formatCurrency(analytics.summary.totalIgst)}
          </div>
          <div className="mt-1 text-[11px] text-black/50">
            Cross-state shipments
          </div>
        </div>

        <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-black/55">
            <span>Taxable Turnover</span>
            <TrendingUp className="size-3.5 text-black/40" />
          </div>
          <div className="mt-2 text-lg font-bold text-black sm:text-xl">
            {formatCurrency(analytics.summary.taxableSales)}
          </div>
          <div className="mt-1 text-[11px] text-black/50">
            Net product value
          </div>
        </div>

        <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-black/55">
            <span>Gross Sales</span>
            <Package className="size-3.5 text-black/40" />
          </div>
          <div className="mt-2 text-lg font-bold text-black sm:text-xl">
            {formatCurrency(analytics.summary.grossSales)}
          </div>
          <div className="mt-1 text-[11px] text-black/50">
            MRP Inclusive revenue
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="mt-6 flex border-b border-black/10">
        <button
          type="button"
          onClick={() => setActiveTab("reports")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
            activeTab === "reports"
              ? "border-black text-black"
              : "border-transparent text-black/50 hover:text-black"
          }`}
        >
          <FileSpreadsheet className="size-4" />
          Monthly GST Reports &amp; Ledger
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("calculator")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
            activeTab === "calculator"
              ? "border-black text-black"
              : "border-transparent text-black/50 hover:text-black"
          }`}
        >
          <Calculator className="size-4" />
          GST &amp; IGST Price Calculator
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
            activeTab === "settings"
              ? "border-black text-black"
              : "border-transparent text-black/50 hover:text-black"
          }`}
        >
          <Settings2 className="size-4" />
          Tax Settings &amp; Origin State
        </button>
      </div>

      {/* TAB 1: Monthly GST Reports & Ledger */}
      {activeTab === "reports" && (
        <div className="mt-6 space-y-6">
          {/* Monthly Trend Chart */}
          <section className="overflow-hidden rounded-xl border border-black/10 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-black">
                  Monthly GST Value Generated ({selectedYear})
                </h2>
                <p className="text-xs text-black/55">
                  Comparison of Taxable Turnover vs Total GST (CGST + SGST + IGST) collected monthly.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-emerald-600" />
                  <span>Total GST</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-neutral-300" />
                  <span>Taxable Value</span>
                </span>
              </div>
            </div>

            <div className="mt-6 h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaeaea" />
                  <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#888888"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => formatCurrencyCompact(val)}
                  />
                  <RechartsTooltip
                    formatter={(value: any, name: any) => [
                      formatCurrency(Number(value) || 0),
                      name === "TotalGST" ? "Total GST" : name,
                    ]}
                    labelFormatter={(label) => `Month: ${label}`}
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderRadius: "8px",
                      border: "1px solid #e5e5e5",
                      fontSize: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                  />
                  <Legend wrapperStyle={{ display: "none" }} />
                  <Bar dataKey="Taxable" fill="#e5e5e5" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="TotalGST" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Monthly Ledger Table */}
          <section className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-black">
                  Monthly GST Collection Ledger
                </h2>
                <p className="text-xs text-black/55">
                  Breakdown by month showing Taxable Turnover, CGST, SGST, and IGST components.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                <thead className="border-b border-black/10 bg-black/[0.025] text-black/60">
                  <tr>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">Month</th>
                    <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Orders</th>
                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Gross Sales</th>
                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Taxable Value</th>
                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">CGST (₹)</th>
                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">SGST (₹)</th>
                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">IGST (₹)</th>
                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Total GST (₹)</th>
                    <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {analytics.monthlyLedger.map((row) => (
                    <tr
                      key={row.monthKey}
                      className={`transition-colors hover:bg-black/[0.015] ${
                        row.totalGst > 0 ? "bg-white font-medium" : "text-black/45"
                      }`}
                    >
                      <td className="px-4 py-3.5 font-semibold text-black">
                        {row.monthName}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px]">
                          {row.orderCount}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono">
                        {formatCurrency(row.grossSales)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono">
                        {formatCurrency(row.taxableSales)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-blue-700">
                        {formatCurrency(row.cgst)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-blue-700">
                        {formatCurrency(row.sgst)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-amber-700">
                        {formatCurrency(row.igst)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-700">
                        {formatCurrency(row.totalGst)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {row.orderCount > 0 && (
                            <BatchTaxInvoiceDialog
                              orders={row.orders}
                              title={`${row.monthName} Tax Invoices`}
                              buttonLabel="Invoices"
                              className="h-7 px-2 text-[11px]"
                              defaultOrigin={settingsForm.originState}
                              defaultGstin={settingsForm.gstin}
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setInspectedMonth(row)
                              setSelectedMonthOrderIds([])
                              setInspectorTab("orders")
                            }}
                            className="inline-flex cursor-pointer items-center gap-1 rounded border border-black/15 bg-white px-2 py-1 text-[11px] font-medium text-black hover:bg-black hover:text-white"
                          >
                            <span>Details</span>
                            <ChevronRight className="size-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-black/15 bg-black/[0.03] text-xs font-bold text-black">
                  <tr>
                    <td className="px-4 py-3">Total ({selectedYear})</td>
                    <td className="px-4 py-3 text-center">{analytics.summary.orderCount}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatCurrency(analytics.summary.grossSales)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatCurrency(analytics.summary.taxableSales)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-blue-700">
                      {formatCurrency(analytics.summary.totalCgst)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-blue-700">
                      {formatCurrency(analytics.summary.totalSgst)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-700">
                      {formatCurrency(analytics.summary.totalIgst)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-800">
                      {formatCurrency(analytics.summary.totalGst)}
                    </td>
                    <td className="px-4 py-3 text-center">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* Product-wise Tax Contribution */}
          {analytics.productSummaries.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
              <div className="border-b border-black/10 px-5 py-4">
                <h2 className="text-sm font-semibold text-black">
                  Product Sales &amp; GST Contribution
                </h2>
                <p className="text-xs text-black/55">
                  Total units sold, taxable turnover, and GST generated by product.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] border-collapse text-left text-xs">
                  <thead className="border-b border-black/10 bg-black/[0.025] text-black/60">
                    <tr>
                      <th className="px-4 py-3 font-semibold uppercase tracking-wider">Product Name</th>
                      <th className="px-4 py-3 font-semibold uppercase tracking-wider">HSN Code</th>
                      <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">GST Slab</th>
                      <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Units Sold</th>
                      <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Taxable Sales</th>
                      <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">GST Generated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {analytics.productSummaries.map((p) => (
                      <tr key={p.title} className="hover:bg-black/[0.015]">
                        <td className="px-4 py-3 font-medium text-black">{p.title}</td>
                        <td className="px-4 py-3 font-mono text-black/70">{p.hsn}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="rounded bg-black/[0.06] px-2 py-0.5 text-[11px] font-semibold">
                            {p.gstRate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-medium">{p.totalUnits}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(p.taxableSales)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                          {formatCurrency(p.totalGst)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 2: GST & IGST Price Calculator */}
      {activeTab === "calculator" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Calculator Tool Card */}
          <section className="overflow-hidden rounded-xl border border-black/10 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-black/10 pb-4">
              <Calculator className="size-5 text-black/70" />
              <div>
                <h2 className="text-sm font-semibold text-black">
                  Interactive GST &amp; IGST Price Calculator
                </h2>
                <p className="text-xs text-black/55">
                  Simulate and calculate base prices, GST amounts, and intra/inter-state tax splits.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {/* Price Input */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-black/70">
                  Product Selling Price (MRP)
                </label>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-black/50">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={calcPrice}
                    onChange={(e) => setCalcPrice(e.target.value)}
                    placeholder="2990"
                    className={`${inputClass} pl-8 text-base font-semibold`}
                  />
                </div>
              </div>

              {/* GST Slab Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-black/70">
                  Select GST Rate Slab
                </label>
                <div className="mt-1.5 grid grid-cols-5 gap-2">
                  {GST_SLABS.map((slab) => (
                    <button
                      key={slab.rate}
                      type="button"
                      onClick={() => setCalcRate(slab.rate)}
                      className={`flex flex-col items-center justify-center rounded-lg border py-2 text-xs font-bold transition-all ${
                        calcRate === slab.rate
                          ? "border-black bg-black text-white shadow-sm"
                          : "border-black/15 bg-white text-black hover:border-black/40 hover:bg-black/[0.02]"
                      }`}
                    >
                      <span>{slab.rate}%</span>
                      <span className="text-[10px] font-normal opacity-80">
                        {slab.rate === 12 ? "Default" : slab.rate === 0 ? "Exempt" : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Transaction Type: Intra-State vs Inter-State */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-black/70">
                  Transaction Location (Shipment)
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCalcIsIntraState(true)}
                    className={`flex flex-col items-start rounded-lg border p-3 text-left transition ${
                      calcIsIntraState
                        ? "border-black bg-black/[0.03] ring-1 ring-black"
                        : "border-black/15 bg-white hover:bg-black/[0.01]"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-black">
                      {calcIsIntraState && <CheckCircle2 className="size-3.5 text-black" />}
                      <span>Intra-State (Within {settingsForm.originState})</span>
                    </div>
                    <span className="mt-1 text-[11px] text-black/55">
                      Split equally: CGST ({calcRate / 2}%) + SGST ({calcRate / 2}%)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCalcIsIntraState(false)}
                    className={`flex flex-col items-start rounded-lg border p-3 text-left transition ${
                      !calcIsIntraState
                        ? "border-black bg-black/[0.03] ring-1 ring-black"
                        : "border-black/15 bg-white hover:bg-black/[0.01]"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-black">
                      {!calcIsIntraState && <CheckCircle2 className="size-3.5 text-black" />}
                      <span>Inter-State (Other States)</span>
                    </div>
                    <span className="mt-1 text-[11px] text-black/55">
                      Single Integrated Tax: IGST ({calcRate}%)
                    </span>
                  </button>
                </div>
              </div>

              {/* Price Inclusivity Toggle */}
              <div className="flex items-center justify-between rounded-lg border border-black/10 bg-neutral-50 px-4 py-3">
                <div>
                  <span className="text-xs font-semibold text-black">Price is Inclusive of GST</span>
                  <p className="text-[11px] text-black/55">
                    Standard Pubesto retail policy (MRP covers GST)
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={calcIsInclusive}
                  onChange={(e) => setCalcIsInclusive(e.target.checked)}
                  className="size-4 cursor-pointer accent-black"
                />
              </div>
            </div>
          </section>

          {/* Calculator Output Breakdown Card */}
          <section className="overflow-hidden rounded-xl border border-black/10 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-black/10 pb-4">
              <div>
                <h2 className="text-sm font-semibold text-black">Tax &amp; Price Breakdown</h2>
                <p className="text-xs text-black/55">
                  Calculated values for invoicing, ERP, and customer bills.
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                {calcRate}% GST Slab
              </span>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-neutral-50 p-3 text-sm">
                <span className="text-black/70">Customer Selling Price (MRP)</span>
                <span className="font-mono text-base font-bold text-black">
                  {formatCurrency(calcResult.grossAmount)}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-black/10 p-3 text-sm">
                <div>
                  <span className="font-medium text-black">Taxable Base Price</span>
                  <span className="block text-[11px] text-black/50">
                    Net price before taxes
                  </span>
                </div>
                <span className="font-mono text-base font-semibold text-black">
                  {formatCurrency(calcResult.taxableAmount)}
                </span>
              </div>

              <div className="rounded-lg border border-black/15 bg-black/[0.02] p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-black">
                  Applied GST Breakdown ({calcRate}%)
                </div>

                <div className="mt-3 space-y-2 text-xs">
                  {calcResult.isIntraState ? (
                    <>
                      <div className="flex items-center justify-between border-b border-black/10 pb-2">
                        <span className="text-black/70">
                          CGST ({calcRate / 2}%) — Central GST
                        </span>
                        <span className="font-mono font-semibold text-blue-700">
                          {formatCurrency(calcResult.cgst)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b border-black/10 pb-2">
                        <span className="text-black/70">
                          SGST ({calcRate / 2}%) — State GST ({settingsForm.originState})
                        </span>
                        <span className="font-mono font-semibold text-blue-700">
                          {formatCurrency(calcResult.sgst)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between border-b border-black/10 pb-2">
                      <span className="text-black/70">
                        IGST ({calcRate}%) — Integrated GST
                      </span>
                      <span className="font-mono font-semibold text-amber-700">
                        {formatCurrency(calcResult.igst)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 text-sm font-bold text-emerald-800">
                    <span>Total GST Amount</span>
                    <span className="font-mono">{formatCurrency(calcResult.totalGst)}</span>
                  </div>
                </div>
              </div>

              {/* Guidance note */}
              <div className="flex items-start gap-2 rounded-lg bg-blue-50/70 p-3 text-[11px] leading-relaxed text-blue-900">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                <p>
                  In Indian GST law, when selling within the registered state (
                  <strong>{settingsForm.originState}</strong>), the tax is divided equally into CGST
                  and SGST. When shipping to another state, IGST is applied at the full rate.
                </p>
              </div>
            </div>
          </section>

          {/* Slabs Reference Guide */}
          <section className="col-span-full overflow-hidden rounded-xl border border-black/10 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-black">Standard GST Slabs Reference</h3>
            <p className="text-xs text-black/55">
              Indian GST rate structure applicable to fashion, apparel, and lifestyle e-commerce.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {GST_SLABS.map((slab) => (
                <div
                  key={slab.rate}
                  className={`rounded-xl border p-4 transition ${
                    slab.rate === 12
                      ? "border-emerald-600 bg-emerald-50/30 ring-1 ring-emerald-600"
                      : "border-black/10 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-black">{slab.label}</span>
                    {slab.rate === 12 && (
                      <span className="rounded bg-emerald-700 px-2 py-0.5 text-[10px] font-bold text-white">
                        RECOMMENDED
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs font-medium text-black/75">{slab.description}</p>
                  <p className="mt-1 text-[11px] text-black/50">
                    <strong>Applicable:</strong> {slab.categoryExamples}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: Store Tax Settings & Origin State */}
      {activeTab === "settings" && (
        <div className="mt-6 max-w-3xl">
          <section className="overflow-hidden rounded-xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="border-b border-black/10 pb-4">
              <h2 className="text-base font-semibold text-black">Tax &amp; GST Configuration</h2>
              <p className="text-xs text-black/55">
                Set store registration details, origin state for intra-state tax determination, and default product slabs.
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="mt-6 space-y-5">
              {/* Origin State */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-black/75">
                  Store Origin State (Tax Registration State)
                </label>
                <p className="mt-0.5 text-[11px] text-black/50">
                  Orders shipped to customers in this state are charged CGST + SGST. All other states are charged IGST.
                </p>
                <div className="mt-2">
                  <Select
                    value={settingsForm.originState}
                    onValueChange={(val) =>
                      setSettingsForm((prev) => ({ ...prev, originState: val }))
                    }
                  >
                    <SelectTrigger className="h-10 w-full rounded-lg border-black/20 bg-white text-sm">
                      <SelectValue placeholder="Select Indian State" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64 bg-white text-black">
                      {INDIAN_STATES.map((st) => (
                        <SelectItem key={st} value={st}>
                          {st}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Seller details on invoices */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-black/75">
                  Registered business name
                </label>
                <p className="mt-0.5 text-[11px] text-black/50">Printed as the seller on every tax invoice.</p>
                <input
                  type="text"
                  maxLength={160}
                  value={settingsForm.legalName}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, legalName: e.target.value }))}
                  placeholder="Pubesto"
                  className={`${inputClass} mt-1.5`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-black/75">
                  Registered address
                </label>
                <p className="mt-0.5 text-[11px] text-black/50">Address registered with your GSTIN.</p>
                <textarea
                  rows={2}
                  maxLength={400}
                  value={settingsForm.businessAddress}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, businessAddress: e.target.value }))}
                  placeholder="Shop / office address, city, PIN"
                  className={`${inputClass} mt-1.5 h-auto py-2`}
                />
              </div>

              {/* GSTIN */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-black/75">
                  Store GSTIN Number
                </label>
                <p className="mt-0.5 text-[11px] text-black/50">
                  15-character GST identification number printed on invoices and GSTR-1 filings.
                </p>
                <input
                  type="text"
                  maxLength={15}
                  value={settingsForm.gstin}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({
                      ...prev,
                      gstin: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="e.g. 07ABCDE1234F1Z5"
                  className={`${inputClass} mt-1.5 font-mono uppercase`}
                />
              </div>

              {/* Default GST Slab */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-black/75">
                    Default GST Rate (%)
                  </label>
                  <p className="mt-0.5 text-[11px] text-black/50">
                    Default rate for newly created products.
                  </p>
                  <Select
                    value={String(settingsForm.defaultGstRate)}
                    onValueChange={(val) =>
                      setSettingsForm((prev) => ({ ...prev, defaultGstRate: Number(val) }))
                    }
                  >
                    <SelectTrigger className="mt-1.5 h-10 w-full rounded-lg border-black/20 bg-white text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-black">
                      {GST_SLABS.map((s) => (
                        <SelectItem key={s.rate} value={String(s.rate)}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-black/75">
                    Default Apparel HSN Code
                  </label>
                  <p className="mt-0.5 text-[11px] text-black/50">
                    Common: 8414 (fans &amp; coolers), 3924 (plastic bottles &amp; boxes), 7323 (steel bottles).
                  </p>
                  <input
                    type="text"
                    value={settingsForm.defaultHsn}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({
                        ...prev,
                        defaultHsn: e.target.value.trim(),
                      }))
                    }
                    placeholder="e.g. 8414"
                    className={`${inputClass} mt-1.5 font-mono`}
                  />
                </div>
              </div>

              {/* Price Inclusive */}
              <div className="rounded-xl border border-black/10 bg-neutral-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <label
                      htmlFor="price-inclusive-checkbox"
                      className="cursor-pointer text-xs font-semibold text-black"
                    >
                      Storefront Prices are Inclusive of GST
                    </label>
                    <p className="mt-1 text-[11px] leading-relaxed text-black/60">
                      When enabled, product prices entered in the catalog represent the final MRP
                      including GST. Taxable base value and tax amounts are extracted automatically
                      for invoicing and reports.
                    </p>
                  </div>
                  <input
                    id="price-inclusive-checkbox"
                    type="checkbox"
                    checked={settingsForm.priceInclusive}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({
                        ...prev,
                        priceInclusive: e.target.checked,
                      }))
                    }
                    className="mt-0.5 size-4 cursor-pointer accent-black"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="submit"
                  disabled={isUpdatingSettings}
                  className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-black px-6 text-xs font-semibold uppercase tracking-wider text-white shadow transition hover:bg-black/85 disabled:cursor-wait disabled:opacity-60"
                >
                  {isUpdatingSettings ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <span>Save Tax Settings</span>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Month Inspector Dialog */}
      <Dialog
        open={Boolean(inspectedMonth)}
        onOpenChange={(open) => {
          if (!open) {
            setInspectedMonth(null)
            setSelectedMonthOrderIds([])
            setInspectorTab("orders")
          }
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto bg-white p-6 pr-14 text-black shadow-2xl">
          {inspectedMonth && (
            <div>
              {/* Header */}
              <DialogHeader className="pr-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800">
                        <Landmark className="size-4" />
                      </div>
                      <DialogTitle className="text-xl font-bold tracking-tight text-black">
                        {inspectedMonth.monthName} — GST Tax Breakdown
                      </DialogTitle>
                    </div>
                    <DialogDescription className="mt-1 text-xs text-black/60">
                      Fiscal compliance, monthly ledger breakdown, and downloadable tax invoices for {inspectedMonth.monthName}.
                    </DialogDescription>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-mono text-xs font-bold text-emerald-800 shadow-2xs">
                      Total GST: {formatCurrency(inspectedMonth.totalGst)}
                    </span>
                    <span className="rounded-full border border-black/10 bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-black/70">
                      {inspectedMonth.orderCount} Orders
                    </span>
                  </div>
                </div>
              </DialogHeader>

              {/* Top KPI Cards */}
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                <div className="rounded-xl border border-black/10 bg-neutral-50/70 p-3.5 shadow-2xs">
                  <span className="text-black/55 font-medium">Gross Sales</span>
                  <p className="mt-1 font-mono text-base font-bold text-black">
                    {formatCurrency(inspectedMonth.grossSales)}
                  </p>
                </div>
                <div className="rounded-xl border border-black/10 bg-neutral-50/70 p-3.5 shadow-2xs">
                  <span className="text-black/55 font-medium">Taxable Turnover</span>
                  <p className="mt-1 font-mono text-base font-bold text-black">
                    {formatCurrency(inspectedMonth.taxableSales)}
                  </p>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3.5 shadow-2xs">
                  <span className="text-blue-900/70 font-medium">CGST + SGST (Local)</span>
                  <p className="mt-1 font-mono text-base font-bold text-blue-800">
                    {formatCurrency(inspectedMonth.cgst + inspectedMonth.sgst)}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3.5 shadow-2xs">
                  <span className="text-amber-900/70 font-medium">IGST (Inter-State)</span>
                  <p className="mt-1 font-mono text-base font-bold text-amber-800">
                    {formatCurrency(inspectedMonth.igst)}
                  </p>
                </div>
              </div>

              {/* Segmented Tab Navigation */}
              <div className="mt-6 flex border-b border-black/10">
                <button
                  type="button"
                  onClick={() => setInspectorTab("orders")}
                  className={`flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
                    inspectorTab === "orders"
                      ? "border-black text-black"
                      : "border-transparent text-black/50 hover:text-black"
                  }`}
                >
                  <Receipt className="size-3.5" />
                  <span>Orders &amp; Tax Invoices</span>
                  <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px]">
                    {inspectedMonth.orders?.length ?? 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setInspectorTab("states")}
                  className={`flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
                    inspectorTab === "states"
                      ? "border-black text-black"
                      : "border-transparent text-black/50 hover:text-black"
                  }`}
                >
                  <Landmark className="size-3.5" />
                  <span>Destination States</span>
                  <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px]">
                    {inspectedMonth.states?.length ?? 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setInspectorTab("products")}
                  className={`flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
                    inspectorTab === "products"
                      ? "border-black text-black"
                      : "border-transparent text-black/50 hover:text-black"
                  }`}
                >
                  <Package className="size-3.5" />
                  <span>Product Sales</span>
                  <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px]">
                    {inspectedMonth.products?.length ?? 0}
                  </span>
                </button>
              </div>

              {/* TAB 1: Orders & Invoices */}
              {inspectorTab === "orders" && (
                <div className="mt-4">
                  {inspectedMonth.orders && inspectedMonth.orders.length > 0 ? (
                    <div>
                      {/* Action Toolbar */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
                        <div className="flex items-center gap-2">
                          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-black">
                            <input
                              type="checkbox"
                              checked={
                                selectedMonthOrderIds.length > 0 &&
                                selectedMonthOrderIds.length === inspectedMonth.orders.length
                              }
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedMonthOrderIds(inspectedMonth.orders.map((o) => o.id))
                                } else {
                                  setSelectedMonthOrderIds([])
                                }
                              }}
                              className="size-3.5 accent-black"
                            />
                            <span>
                              {selectedMonthOrderIds.length > 0
                                ? `${selectedMonthOrderIds.length} of ${inspectedMonth.orders.length} selected`
                                : `Select All (${inspectedMonth.orders.length})`}
                            </span>
                          </label>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              exportInvoicesCsv(
                                selectedMonthOrderIds.length > 0
                                  ? inspectedMonth.orders.filter((o) =>
                                      selectedMonthOrderIds.includes(o.id)
                                    )
                                  : inspectedMonth.orders,
                                `pubesto-tax-invoices-${inspectedMonth.monthKey}.csv`,
                                settingsForm.originState,
                                settingsForm.gstin
                              )
                            }
                            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-black/20 bg-white px-2.5 text-xs font-medium text-black shadow-2xs transition hover:bg-black/[0.04]"
                          >
                            <FileSpreadsheet className="size-3.5 text-emerald-700" />
                            <span>Export CSV</span>
                          </button>

                          {selectedMonthOrderIds.length > 0 ? (
                            <BatchTaxInvoiceDialog
                              orders={inspectedMonth.orders.filter((o) =>
                                selectedMonthOrderIds.includes(o.id)
                              )}
                              title={`Selected (${selectedMonthOrderIds.length}) Invoices`}
                              buttonLabel={`Download Selected (${selectedMonthOrderIds.length}) PDF`}
                              defaultOrigin={settingsForm.originState}
                              defaultGstin={settingsForm.gstin}
                            />
                          ) : (
                            <BatchTaxInvoiceDialog
                              orders={inspectedMonth.orders}
                              title={`${inspectedMonth.monthName} Tax Invoices`}
                              buttonLabel="Download All Invoices (Batch PDF)"
                              defaultOrigin={settingsForm.originState}
                              defaultGstin={settingsForm.gstin}
                            />
                          )}
                        </div>
                      </div>

                      {/* Orders & Invoices Table */}
                      <div className="max-h-72 overflow-y-auto rounded-xl border border-black/10">
                        <table className="w-full border-collapse text-left text-xs">
                          <thead className="sticky top-0 z-10 bg-neutral-100 text-black/70 shadow-xs">
                            <tr>
                              <th className="w-8 px-3 py-2.5 text-center">
                                <span className="sr-only">Select</span>
                              </th>
                              <th className="px-3 py-2.5 font-medium">Order</th>
                              <th className="px-3 py-2.5 font-medium">Invoice No</th>
                              <th className="px-3 py-2.5 font-medium">Customer</th>
                              <th className="px-3 py-2.5 font-medium">State</th>
                              <th className="px-3 py-2.5 text-right font-medium">Taxable</th>
                              <th className="px-3 py-2.5 text-right font-medium">GST Amount</th>
                              <th className="px-3 py-2.5 text-center font-medium">
                                Individual Invoice
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black/5">
                            {inspectedMonth.orders.map((o) => (
                              <tr
                                key={o.id}
                                className={`transition hover:bg-black/[0.02] ${
                                  selectedMonthOrderIds.includes(o.id) ? "bg-black/[0.025]" : ""
                                }`}
                              >
                                <td className="px-3 py-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedMonthOrderIds.includes(o.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedMonthOrderIds((prev) => [...prev, o.id])
                                      } else {
                                        setSelectedMonthOrderIds((prev) =>
                                          prev.filter((id) => id !== o.id)
                                        )
                                      }
                                    }}
                                    className="size-3.5 accent-black"
                                  />
                                </td>
                                <td className="px-3 py-2 font-semibold text-black">
                                  <Link
                                    href={`/dashboard/orders/${o.id}`}
                                    className="text-[#0c3152] hover:underline"
                                  >
                                    #{o.number}
                                  </Link>
                                </td>
                                <td className="px-3 py-2 font-mono text-[11px] text-black/75">
                                  INV-PUB-{String(o.number).padStart(5, "0")}
                                </td>
                                <td className="px-3 py-2">
                                  <p className="max-w-[140px] truncate font-medium text-black">
                                    {o.customerName}
                                  </p>
                                  <p className="max-w-[140px] truncate text-[11px] text-black/50">
                                    {o.email}
                                  </p>
                                </td>
                                <td className="px-3 py-2">
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                      o.isIntraState
                                        ? "bg-blue-50 text-blue-700"
                                        : "bg-amber-50 text-amber-700"
                                    }`}
                                  >
                                    {o.state}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right font-mono">
                                  {formatCurrency(o.taxableAmount)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700">
                                  {formatCurrency(o.totalGst)}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <TaxInvoiceDialog
                                      order={o}
                                      buttonVariant="compact"
                                      buttonLabel="Invoice"
                                      defaultOrigin={settingsForm.originState}
                                      defaultGstin={settingsForm.gstin}
                                    />
                                    <Link
                                      href={`/dashboard/orders/${o.id}`}
                                      className="inline-flex size-7 items-center justify-center rounded border border-black/15 bg-white text-black/60 transition hover:bg-black hover:text-white"
                                      title="Open Order Details"
                                    >
                                      <ExternalLink className="size-3" />
                                    </Link>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-black/15 bg-neutral-50/60 px-6 py-12 text-center">
                      <div className="flex size-12 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-2xs">
                        <Receipt className="size-6" />
                      </div>
                      <h3 className="mt-4 text-sm font-semibold text-black">
                        No Orders or Invoices in {inspectedMonth.monthName}
                      </h3>
                      <p className="mt-1.5 max-w-md text-xs leading-relaxed text-black/55">
                        There are no customer orders or taxable sales recorded for this fiscal month.
                        When orders are placed, their individual tax invoices and month-wise batch downloads will be available here.
                      </p>
                      <div className="mt-5 flex items-center gap-2">
                        <Link
                          href="/dashboard/orders"
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-black/20 bg-white px-3 text-xs font-medium text-black shadow-2xs transition hover:bg-black/[0.04]"
                        >
                          <Package className="size-3.5" />
                          <span>View All Store Orders</span>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Destination States */}
              {inspectorTab === "states" && (
                <div className="mt-4">
                  {inspectedMonth.states.length > 0 ? (
                    <div className="max-h-72 overflow-y-auto rounded-xl border border-black/10">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead className="sticky top-0 bg-neutral-100 text-black/70 shadow-xs">
                          <tr>
                            <th className="px-3.5 py-2.5 font-medium">State</th>
                            <th className="px-3.5 py-2.5 font-medium">Supply Type</th>
                            <th className="px-3.5 py-2.5 text-center font-medium">Orders</th>
                            <th className="px-3.5 py-2.5 text-right font-medium">Taxable Value</th>
                            <th className="px-3.5 py-2.5 text-right font-medium">GST Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5">
                          {inspectedMonth.states.map((st) => (
                            <tr key={st.state} className="hover:bg-black/[0.015]">
                              <td className="px-3.5 py-2.5 font-medium text-black">{st.state}</td>
                              <td className="px-3.5 py-2.5">
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                    st.isIntraState
                                      ? "bg-blue-50 text-blue-700"
                                      : "bg-amber-50 text-amber-700"
                                  }`}
                                >
                                  {st.isIntraState ? "Intra (CGST+SGST)" : "Inter (IGST)"}
                                </span>
                              </td>
                              <td className="px-3.5 py-2.5 text-center font-medium">{st.orderCount}</td>
                              <td className="px-3.5 py-2.5 text-right font-mono">
                                {formatCurrency(st.taxableAmount)}
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono font-bold text-emerald-700">
                                {formatCurrency(st.totalGst)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-black/15 bg-neutral-50/60 px-6 py-10 text-center">
                      <div className="flex size-10 items-center justify-center rounded-full bg-neutral-100 text-black/60">
                        <Landmark className="size-5" />
                      </div>
                      <p className="mt-3 text-xs font-semibold text-black">
                        No State-Specific Shipments in {inspectedMonth.monthName}
                      </p>
                      <p className="mt-1 text-[11px] text-black/50">
                        State-wise tax distribution will populate automatically when orders are dispatched.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Product Sales */}
              {inspectorTab === "products" && (
                <div className="mt-4">
                  {inspectedMonth.products.length > 0 ? (
                    <div className="max-h-72 overflow-y-auto rounded-xl border border-black/10">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead className="sticky top-0 bg-neutral-100 text-black/70 shadow-xs">
                          <tr>
                            <th className="px-3.5 py-2.5 font-medium">Product</th>
                            <th className="px-3.5 py-2.5 font-medium">HSN Code</th>
                            <th className="px-3.5 py-2.5 text-center font-medium">Units Sold</th>
                            <th className="px-3.5 py-2.5 text-right font-medium">Taxable Value</th>
                            <th className="px-3.5 py-2.5 text-right font-medium">GST Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5">
                          {inspectedMonth.products.map((pr) => (
                            <tr key={pr.id} className="hover:bg-black/[0.015]">
                              <td className="px-3.5 py-2.5 font-medium text-black">{pr.title}</td>
                              <td className="px-3.5 py-2.5 font-mono text-black/60">{pr.hsn}</td>
                              <td className="px-3.5 py-2.5 text-center font-medium">{pr.quantity}</td>
                              <td className="px-3.5 py-2.5 text-right font-mono">
                                {formatCurrency(pr.taxableAmount)}
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono font-bold text-emerald-700">
                                {formatCurrency(pr.gstAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-black/15 bg-neutral-50/60 px-6 py-10 text-center">
                      <div className="flex size-10 items-center justify-center rounded-full bg-neutral-100 text-black/60">
                        <Package className="size-5" />
                      </div>
                      <p className="mt-3 text-xs font-semibold text-black">
                        No Itemized Product Sales in {inspectedMonth.monthName}
                      </p>
                      <p className="mt-1 text-[11px] text-black/50">
                        Product HSN codes and GST slab contributions will populate once items are ordered.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  )
}
