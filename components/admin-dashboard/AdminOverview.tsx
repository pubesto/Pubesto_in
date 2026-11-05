"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import type { DateRange } from "react-day-picker"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { CalendarDays, ChevronDown, ChevronUp, Loader2 } from "lucide-react"

import { fetchOverviewDataAction } from "@/app/actions/overview"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { OverviewData } from "@/lib/server/dal/overview"

function formatRange(range: DateRange | undefined) {
  if (!range?.from) return "Custom range"
  const formatter = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
  if (!range.to) return formatter.format(range.from)
  return `${formatter.format(range.from)} – ${formatter.format(range.to)}`
}

function formatCurrency(amount: number, currency: string = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

function generateSparkline(values: number[], width = 54, height = 20) {
  if (!values.length) return `0,${height} ${width},${height}`
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  return values
    .map((val, idx) => {
      const x = (idx / Math.max(1, values.length - 1)) * width
      const y = height - 2 - ((val - min) / range) * (height - 4)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
}

type AdminOverviewProps = {
  initialData?: OverviewData
}

export function AdminOverview({ initialData }: AdminOverviewProps) {
  const [data, setData] = useState<OverviewData | undefined>(initialData)
  const [isPending, startTransition] = useTransition()

  const [isExpanded, setIsExpanded] = useState(true)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [rangeLabel, setRangeLabel] = useState(data?.rangeLabel ?? "Last 30 days")
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [rangeAmount, setRangeAmount] = useState("30")
  const [dateUnit, setDateUnit] = useState("Days")
  const [includeToday, setIncludeToday] = useState(true)
  const [selectedMetric, setSelectedMetric] = useState("Sessions")

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening"
  const adminName = data?.adminName || "Admin"

  const handlePresetSelect = (preset: string) => {
    setRangeLabel(preset)
    if (preset !== "Custom range") setDateRange(undefined)
    setIsDatePickerOpen(false)

    startTransition(async () => {
      const result = await fetchOverviewDataAction({ preset })
      if (result.success && result.data) {
        setData(result.data)
      }
    })
  }

  const handleApplyCustom = () => {
    const formattedLabel = dateRange?.from
      ? formatRange(dateRange)
      : `Last ${rangeAmount} ${dateUnit.toLowerCase()}${includeToday ? "" : " excluding today"}`
    setRangeLabel(formattedLabel)
    setIsDatePickerOpen(false)

    startTransition(async () => {
      const result = await fetchOverviewDataAction({
        from: dateRange?.from,
        to: dateRange?.to,
        amount: rangeAmount,
        unit: dateUnit,
        includeToday,
      })
      if (result.success && result.data) {
        setData(result.data)
      }
    })
  }

  // Active chart series based on selected metric
  const chartPoints = useMemo(() => {
    if (!data?.chartData?.length) return []
    return data.chartData.map((pt) => {
      let current = pt.currentSessions
      let previous = pt.previousSessions

      if (selectedMetric === "Total sales") {
        current = pt.currentSales
        previous = pt.previousSales
      } else if (selectedMetric === "Orders") {
        current = pt.currentOrders
        previous = pt.previousOrders
      } else if (selectedMetric === "Conversion rate") {
        current = pt.currentConversion
        previous = pt.previousConversion
      }

      return {
        date: pt.date,
        current,
        previous,
      }
    })
  }, [data?.chartData, selectedMetric])

  // Sparkline points for each metric
  const sparklines = useMemo(() => {
    if (!data?.chartData?.length) return {}
    return {
      Sessions: generateSparkline(data.chartData.map((p) => p.currentSessions)),
      "Total sales": generateSparkline(data.chartData.map((p) => p.currentSales)),
      Orders: generateSparkline(data.chartData.map((p) => p.currentOrders)),
      "Conversion rate": generateSparkline(data.chartData.map((p) => p.currentConversion)),
    } as Record<string, string>
  }, [data?.chartData])

  const maxVal = useMemo(() => {
    if (!chartPoints.length) return 10
    const peak = Math.max(...chartPoints.map((p) => Math.max(p.current, p.previous)))
    return peak <= 5 ? 10 : Math.ceil(peak * 1.25)
  }, [chartPoints])

  return (
    <section className="relative flex min-w-0 flex-1 flex-col gap-4 bg-[#f5f5f5] p-4 pt-6">
      <div className="relative flex items-center justify-between gap-4">
        <div>
          <h1 className="mt-1 flex items-center gap-2 text-lg font-semibold tracking-tight text-black">
            {greeting}, {adminName}
            {isPending ? <Loader2 className="size-4 animate-spin text-black/40" /> : null}
          </h1>
          <p className="mt-0.5 text-xs text-black/55">
            Here&apos;s what&apos;s happening with your store today.
          </p>
        </div>
        <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-expanded={isDatePickerOpen}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-black/25 bg-white px-2.5 text-xs font-medium text-black/75 shadow-sm transition-colors hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25"
            >
              <CalendarDays className="size-3.5 text-black/65" />
              {rangeLabel}
              <ChevronDown className="size-3.5 text-black/55" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="z-30 flex w-[min(680px,calc(100vw-2rem))] overflow-hidden rounded-xl border-black/15 p-0 shadow-xl"
          >
            <div className="hidden w-40 shrink-0 border-r border-black/10 bg-[#fafafa] p-2 sm:block">
              {["Today", "Yesterday", "Last 7 days", "Last 30 days", "Quarter to date", "Custom range"].map(
                (option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handlePresetSelect(option)}
                    className={`w-full rounded-md px-2 py-2 text-left text-xs transition-colors hover:bg-black/5 ${
                      option === rangeLabel ? "bg-black/10 font-medium" : "text-black/70"
                    }`}
                  >
                    {option}
                  </button>
                ),
              )}
            </div>
            <div className="min-w-0 flex-1 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-black/70">Last</span>
                <input
                  aria-label="Number of days"
                  value={rangeAmount}
                  onChange={(event) => setRangeAmount(event.target.value)}
                  inputMode="numeric"
                  className="h-8 w-20 rounded-md border border-black/20 px-2 outline-none focus:border-black/50"
                />
                <Select value={dateUnit} onValueChange={setDateUnit}>
                  <SelectTrigger aria-label="Date unit" className="h-8 w-24 border-black/20 px-2 text-xs shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="Days">Days</SelectItem>
                    <SelectItem value="Weeks">Weeks</SelectItem>
                    <SelectItem value="Months">Months</SelectItem>
                  </SelectContent>
                </Select>
                <label className="inline-flex items-center gap-1.5 text-black/70">
                  <input
                    type="checkbox"
                    checked={includeToday}
                    onChange={(event) => setIncludeToday(event.target.checked)}
                    className="accent-black"
                  />{" "}
                  Include today
                </label>
              </div>
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                className="mt-4 max-w-full"
              />
              <div className="mt-5 flex justify-end gap-2 border-t border-black/10 pt-3">
                <button
                  type="button"
                  onClick={() => setIsDatePickerOpen(false)}
                  className="rounded-md border border-black/20 px-3 py-1.5 text-xs hover:bg-black/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyCustom}
                  className="rounded-md bg-black px-3 py-1.5 text-xs text-white hover:bg-black/80"
                >
                  Apply
                </button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="relative rounded-xl border border-black/10 bg-white p-2 shadow-sm sm:p-3">
        <button
          type="button"
          aria-label={isExpanded ? "Collapse overview" : "Expand overview"}
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((expanded) => !expanded)}
          className="absolute right-3 top-3 z-10 inline-flex size-7 items-center justify-center rounded-md text-black/50 transition-colors hover:bg-black/5 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
        >
          {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>

        <div className="grid grid-cols-2 gap-2 pr-8 sm:grid-cols-4">
          {(data?.metrics ?? []).map((metric) => (
            <button
              type="button"
              key={metric.label}
              aria-pressed={selectedMetric === metric.label}
              onClick={() => setSelectedMetric(metric.label)}
              className={`relative min-h-14 rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25 ${
                selectedMetric === metric.label
                  ? "bg-[#f0f0f0]"
                  : "bg-white hover:bg-black/[0.03]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-black/75">{metric.label}</p>
                {selectedMetric === metric.label ? <span className="text-sm text-black/45">↗</span> : null}
              </div>
              <p className="mt-1 text-sm font-semibold text-black">
                {metric.value}{" "}
                <span
                  className={`font-normal ${
                    metric.isPositive === true
                      ? "text-emerald-600"
                      : metric.isPositive === false
                        ? "text-rose-600"
                        : "text-black/55"
                  }`}
                >
                  {metric.change}
                </span>
              </p>
              {!isExpanded && sparklines[metric.label] ? (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 54 20"
                  className="pointer-events-none absolute bottom-2 right-3 h-5 w-14"
                  preserveAspectRatio="none"
                >
                  <polyline
                    points={sparklines[metric.label]}
                    fill="none"
                    stroke="#08a7f5"
                    strokeWidth="1.2"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              ) : null}
            </button>
          ))}
        </div>

        {isExpanded ? (
          <div className="mt-4 h-[220px] min-w-0 w-full">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              minHeight={220}
              initialDimension={{ width: 320, height: 220 }}
            >
              <LineChart data={chartPoints} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e5e5e5" vertical={false} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#737373", fontSize: 11 }}
                  dy={8}
                />
                <YAxis
                  domain={[0, maxVal]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#737373", fontSize: 11 }}
                  width={28}
                />
                <Tooltip
                  cursor={{ stroke: "#d4d4d4", strokeDasharray: "3 3" }}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e5e5e5",
                    fontSize: 12,
                  }}
                  formatter={(val: unknown) => {
                    const num = typeof val === "number" ? val : Number(val) || 0
                    if (selectedMetric === "Total sales") return [formatCurrency(num), ""]
                    if (selectedMetric === "Conversion rate") return [`${num.toFixed(1)}%`, ""]
                    return [num, ""]
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="previous"
                  stroke="#8bd4f5"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="current"
                  stroke="#08a7f5"
                  strokeWidth={1.8}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : null}

        {isExpanded && data ? (
          <div className="flex justify-center gap-5 pt-2 text-[11px] text-black/55">
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#08a7f5]" /> {data.currentPeriodLabel}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#8bd4f5]" /> {data.previousPeriodLabel}
            </span>
          </div>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Link
          href="/dashboard/orders"
          className="flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-medium transition hover:bg-black/[0.02]"
        >
          <span aria-hidden>▣</span> {data?.ordersToFulfil ?? 0}{" "}
          {data?.ordersToFulfil === 1 ? "order" : "orders"} to fulfil
        </Link>
        <Link
          href="/dashboard/orders"
          className="flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-medium transition hover:bg-black/[0.02]"
        >
          <span aria-hidden>▱</span> {data?.paymentsToCapture ?? 0}{" "}
          {data?.paymentsToCapture === 1 ? "payment" : "payments"} to capture
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr_1fr]">
        <section className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent orders</h2>
            <Link
              href="/dashboard/orders"
              className="text-xs text-black/55 underline underline-offset-2 hover:text-black"
            >
              View all
            </Link>
          </div>
          <div className="mt-3 divide-y divide-black/10">
            {data?.recentOrders && data.recentOrders.length > 0 ? (
              data.recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/dashboard/orders/${order.id}`}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left text-xs transition hover:bg-black/[0.02]"
                >
                  <span className="font-medium text-[#0c3152]">PUB-{String(order.number).padStart(5, "0")}</span>
                  <span className="text-black/55">{order.statusLabel}</span>
                  <span className="font-medium">{formatCurrency(order.total, order.currency)}</span>
                </Link>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-black/50">
                No orders yet.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Top products</h2>
            <Link
              href="/dashboard/products"
              className="text-xs text-black/55 underline underline-offset-2 hover:text-black"
            >
              View all
            </Link>
          </div>
          <div className="mt-3 space-y-3">
            {data?.topProducts && data.topProducts.length > 0 ? (
              data.topProducts.map((product) => (
                <div key={product.title} className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate text-black/70">{product.title}</span>
                  <span className="shrink-0 font-medium">{product.soldCount} sold</span>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-black/50">
                No products sold yet.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Quick actions</h2>
          <div className="mt-3 grid gap-2">
            <Link
              href="/dashboard/products/new"
              className="flex items-center justify-between rounded-md border border-black/15 px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-black hover:text-white"
            >
              <span>Add product</span>
              <span className="text-[11px] text-black/50 group-hover:text-white/80">{data?.catalogSnapshot?.totalProducts ?? 0} products</span>
            </Link>
            <Link
              href="/dashboard/products/collections"
              className="flex items-center justify-between rounded-md border border-black/15 px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-black hover:text-white"
            >
              <span>Manage collections</span>
              <span className="text-[11px] text-black/50 group-hover:text-white/80">{data?.catalogSnapshot?.totalCollections ?? 0} collections</span>
            </Link>
            <Link
              href="/dashboard/customers"
              className="flex items-center justify-between rounded-md border border-black/15 px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-black hover:text-white"
            >
              <span>View customers</span>
              <span className="text-[11px] text-black/50 group-hover:text-white/80">{data?.customerSnapshot?.totalCustomers ?? 0} customers</span>
            </Link>
          </div>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <section className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Store health</h2>
            <span
              className={`size-2 rounded-full ${
                (data?.storeHealth.percentage ?? 100) >= 90 ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
          </div>
          <p className="mt-3 text-2xl font-semibold">{data?.storeHealth.percentage ?? 100}%</p>
          <p className="mt-1 text-xs text-black/55">
            {data?.storeHealth.statusText ?? "All systems operational"}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/10">
            <div
              className={`h-full rounded-full ${
                (data?.storeHealth.percentage ?? 100) >= 90 ? "bg-emerald-500" : "bg-amber-500"
              }`}
              style={{ width: `${data?.storeHealth.percentage ?? 100}%` }}
            />
          </div>
        </section>

        <section className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Traffic sources</h2>
          <div className="mt-3 space-y-2.5 text-xs">
            {(data?.trafficSources ?? [
              { source: "Direct store", percentage: "64%" },
              { source: "Search / Social", percentage: "36%" },
            ]).map((item) => (
              <div key={item.source}>
                <div className="flex justify-between text-black/70">
                  <span>{item.source}</span>
                  <span className="font-medium text-black">{item.percentage}</span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-black/10">
                  <div
                    className="h-full rounded-full bg-[#08a7f5]"
                    style={{ width: item.percentage }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Inventory alerts</h2>
          <div className="mt-3 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-black/70">Low stock</span>
              <span className="rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-800">
                {data?.inventoryAlerts.lowStockCount ?? 0} items
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-black/70">Out of stock</span>
              <span className="rounded-full bg-red-100 px-2 py-1 font-medium text-red-800">
                {data?.inventoryAlerts.outOfStockCount ?? 0} items
              </span>
            </div>
            <Link
              href="/dashboard/products/inventory"
              className="inline-block pt-1 text-black/55 underline underline-offset-2 hover:text-black"
            >
              Review inventory
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Customer snapshot</h2>
            <Link
              href="/dashboard/customers"
              className="text-xs text-black/55 underline underline-offset-2 hover:text-black"
            >
              View all
            </Link>
          </div>
          <p className="mt-3 text-2xl font-semibold">
            {(data?.customerSnapshot.totalCustomers ?? 0).toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-black/55">Total customers</p>
          <p
            className={`mt-3 text-xs font-medium ${
              data?.customerSnapshot.isPositiveGrowth === false
                ? "text-rose-600"
                : "text-emerald-700"
            }`}
          >
            {data?.customerSnapshot.growthChange ?? "—"} this period
          </p>
        </section>
      </div>
    </section>
  )
}
