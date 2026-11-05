"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { BarChart3, CircleHelp, Loader2, MonitorPlay, MousePointerClick, Target } from "lucide-react"

import { fetchAnalyticsAction } from "@/app/actions/analytics"
import {
  DateRangePicker,
  type AnalyticsRangeSelection,
} from "@/components/admin-dashboard/analytics/date-range-picker"
import type { StoreAnalytics } from "@/lib/server/dal/analytics"

const BLUE = "#08a7f5"
const LIGHT_BLUE = "#8bd4f5"
const PALETTE = ["#08a7f5", "#8bd4f5", "#0f6fb0", "#c7e9f8", "#5bbde9", "#2f4858"]

function money(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount)
}

export function Panel({
  title,
  children,
  className = "",
  action,
}: {
  title: string
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}) {
  return (
    <section className={`rounded-xl border border-black/10 bg-white p-4 shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="w-fit border-b border-dotted border-black/55 text-sm font-medium text-black/75">{title}</h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function MetricCard({
  label,
  value,
  change,
  isPositive,
  selected,
  onSelect,
}: {
  label: string
  value: string
  change: string
  isPositive: boolean | null
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`rounded-xl border border-black/10 p-4 text-left shadow-sm transition-colors ${
        selected ? "bg-[#f0f0f0]" : "bg-white hover:bg-black/[0.02]"
      }`}
    >
      <p className="w-fit border-b border-dotted border-black/55 text-sm font-medium text-black/75">{label}</p>
      <p className="mt-1 text-lg font-semibold text-black/80">
        {value}{" "}
        <span
          className={`text-sm font-normal ${
            isPositive === true ? "text-emerald-600" : isPositive === false ? "text-rose-600" : "text-black/40"
          }`}
        >
          {change}
        </span>
      </p>
      <div className={`mt-2 h-0.5 w-11 ${selected ? "bg-[#08a7f5]" : "bg-[#55c5f7]"}`} />
    </button>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[160px] items-center justify-center text-sm text-black/55">{children}</div>
}

function BarList({
  rows,
  max,
  format = (value: number) => value.toLocaleString("en-IN"),
}: {
  rows: Array<{ label: string; value: number; hint?: string }>
  max?: number
  format?: (value: number) => string
}) {
  if (!rows.length) return <EmptyState>No data for this date range</EmptyState>
  const peak = max ?? Math.max(...rows.map((row) => row.value), 1)
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="truncate text-black/75" title={row.label}>
              {row.label}
              {row.hint ? <span className="ml-2 text-black/40">{row.hint}</span> : null}
            </span>
            <span className="shrink-0 font-medium text-black/75">{format(row.value)}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-sm bg-black/[0.05]">
            <div className="h-full rounded-sm bg-[#75c5e5]" style={{ width: `${Math.max(2, (row.value / peak) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function TimeseriesChart({
  data,
  dataKey,
  previousKey,
  format,
}: {
  data: StoreAnalytics["timeseries"]
  dataKey: keyof StoreAnalytics["timeseries"][number]
  previousKey?: keyof StoreAnalytics["timeseries"][number]
  format: (value: number) => string
}) {
  return (
    <div className="h-[260px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 320, height: 260 }}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e5e5e5" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#737373", fontSize: 11 }} dy={8} minTickGap={24} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#737373", fontSize: 11 }} width={44} tickFormatter={(value) => format(Number(value))} />
          <Tooltip
            cursor={{ stroke: "#d4d4d4", strokeDasharray: "3 3" }}
            contentStyle={{ borderRadius: 8, border: "1px solid #e5e5e5", fontSize: 12 }}
            formatter={(value: unknown) => [format(Number(value) || 0), ""]}
          />
          {previousKey ? (
            <Line type="monotone" dataKey={previousKey} stroke={LIGHT_BLUE} strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
          ) : null}
          <Line type="monotone" dataKey={dataKey} stroke={BLUE} strokeWidth={1.8} dot={false} activeDot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function AnalyticsDashboard({ initialData }: { initialData: StoreAnalytics }) {
  const [data, setData] = useState(initialData)
  const [rangeLabel, setRangeLabel] = useState(initialData.range.label)
  const [selectedMetric, setSelectedMetric] = useState("sessions")
  const [isPending, startTransition] = useTransition()

  function changeRange(selection: AnalyticsRangeSelection, label: string) {
    setRangeLabel(label)
    startTransition(async () => {
      const result = await fetchAnalyticsAction(selection)
      if (result.success) setData(result.data)
    })
  }

  const chartConfig = useMemo(() => {
    switch (selectedMetric) {
      case "sales":
        return { key: "sales" as const, previous: "previousSales" as const, format: money }
      case "orders":
        return { key: "orders" as const, previous: "previousOrders" as const, format: (value: number) => String(Math.round(value)) }
      case "conversion":
        return { key: "conversion" as const, previous: "previousConversion" as const, format: (value: number) => `${value.toFixed(1)}%` }
      case "bounce":
        return { key: "bounceRate" as const, previous: undefined, format: (value: number) => `${Math.round(value)}%` }
      case "visitors":
        return { key: "visitors" as const, previous: undefined, format: (value: number) => String(Math.round(value)) }
      default:
        return { key: "sessions" as const, previous: "previousSessions" as const, format: (value: number) => String(Math.round(value)) }
    }
  }, [selectedMetric])

  const funnelSteps = [
    { label: "Sessions", value: data.funnel.sessions },
    { label: "Added to cart", value: data.funnel.addToCart },
    { label: "Reached checkout", value: data.funnel.beginCheckout },
    { label: "Completed checkout", value: data.funnel.purchases },
  ]

  const deviceTotal = data.devices.reduce((sum, row) => sum + row.sessions, 0)

  return (
    <main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <BarChart3 className="size-4" />
          Analytics
          {isPending ? <Loader2 className="size-4 animate-spin text-black/40" /> : null}
        </h1>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/analytics/recordings"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-black/[0.06] px-3 text-xs font-medium hover:bg-black/10"
          >
            <MonitorPlay className="size-3.5" />
            Recordings
          </Link>
          <Link
            href="/dashboard/analytics/heatmaps"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-black/[0.06] px-3 text-xs font-medium hover:bg-black/10"
          >
            <MousePointerClick className="size-3.5" />
            Heatmaps
          </Link>
          <Link
            href="/dashboard/analytics/reports"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-black px-3 text-xs font-medium text-white hover:bg-black/80"
          >
            All reports
          </Link>
        </div>
      </header>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <DateRangePicker label={rangeLabel} onChange={changeRange} />
        <span className="text-xs text-black/50">
          Compared with {data.range.previousLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.metrics.slice(0, 8).map((metric) => (
          <MetricCard
            key={metric.key}
            label={metric.label}
            value={metric.value}
            change={metric.change}
            isPositive={metric.isPositive}
            selected={selectedMetric === metric.key}
            onSelect={() => setSelectedMetric(["aov", "pages"].includes(metric.key) ? selectedMetric : metric.key)}
          />
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <Panel title={`${data.metrics.find((metric) => metric.key === selectedMetric)?.label ?? "Sessions"} over time`}>
          <p className="text-xl font-semibold text-black/75">
            {data.metrics.find((metric) => metric.key === selectedMetric)?.value}
          </p>
          <div className="mt-3">
            <TimeseriesChart data={data.timeseries} dataKey={chartConfig.key} previousKey={chartConfig.previous} format={chartConfig.format} />
          </div>
          <div className="mt-2 flex items-center justify-center gap-5 text-xs text-black/55">
            <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#08a7f5]" />{data.range.currentLabel}</span>
            {chartConfig.previous ? (
              <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#8bd4f5]" />{data.range.previousLabel}</span>
            ) : null}
          </div>
        </Panel>

        <Panel title="Total sales breakdown">
          <div className="space-y-1">
            {[
              ["Gross sales", money(data.sales.gross)],
              ["Discounts", `-${money(data.sales.discounts)}`],
              ["Shipping charges", money(data.sales.shipping)],
              ["GST included", money(data.sales.taxes)],
              ["Total sales", money(data.sales.total)],
              ["Orders", String(data.sales.orders)],
              ["Average order value", money(data.sales.averageOrderValue)],
            ].map(([label, value], index) => (
              <div key={label} className={`flex items-center justify-between rounded-lg px-2 py-3 text-sm ${index % 2 === 1 ? "bg-black/[0.035]" : ""}`}>
                <span className="text-blue-600">{label}</span>
                <span className="font-medium text-black/75">{value}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel
          title="Sessions by traffic source"
          action={<Link href="/dashboard/analytics/reports/sessions-by-channel" className="text-xs text-black/55 underline underline-offset-2 hover:text-black">View report</Link>}
        >
          <BarList
            rows={data.channels.slice(0, 8).map((row) => ({
              label: row.label,
              value: row.sessions,
              hint: row.orders ? `${row.orders} ${row.orders === 1 ? "order" : "orders"}` : undefined,
            }))}
          />
          {!data.channels.length ? null : (
            <p className="mt-4 text-[11px] leading-relaxed text-black/50">
              WhatsApp and Instagram app links usually arrive without a referrer. Add
              <code className="mx-1 rounded bg-black/5 px-1">?utm_source=whatsapp</code>
              or <code className="mx-1 rounded bg-black/5 px-1">?utm_source=instagram</code> to shared links so they are counted correctly.
            </p>
          )}
        </Panel>

        <Panel title="Conversion rate breakdown">
          <p className="text-xl font-semibold text-black/75">
            {data.funnel.sessions ? ((data.funnel.purchases / data.funnel.sessions) * 100).toFixed(2) : "0.00"}%
          </p>
          <div className="mt-4 grid grid-cols-4 divide-x divide-black/10">
            {funnelSteps.map((step) => (
              <div key={step.label} className="min-w-0 px-2 first:pl-0 last:pr-0">
                <p className="truncate text-xs text-black/75">{step.label}</p>
                <p className="mt-1 text-sm font-medium text-black/75">{step.value.toLocaleString("en-IN")}</p>
                <p className="text-xs text-black/55">
                  {data.funnel.sessions ? Math.round((step.value / data.funnel.sessions) * 100) : 0}%
                </p>
              </div>
            ))}
          </div>
          <div className="mt-5 h-[120px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 320, height: 120 }}>
              <BarChart data={funnelSteps} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" hide />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e5e5", fontSize: 12 }} />
                <Bar dataKey="value" fill={BLUE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Sessions by device type">
          {deviceTotal === 0 ? (
            <EmptyState>No sessions yet</EmptyState>
          ) : (
            <div className="flex items-center gap-6">
              <div className="h-[200px] w-[200px] shrink-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 200, height: 200 }}>
                  <PieChart>
                    <Pie data={data.devices} dataKey="sessions" nameKey="device" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="none">
                      {data.devices.map((row, index) => (
                        <Cell key={row.device} fill={PALETTE[index % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e5e5", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3 text-xs text-black/70">
                {data.devices.map((row, index) => (
                  <div key={row.device} className="flex items-center gap-2">
                    <span className="size-3 rounded-sm" style={{ background: PALETTE[index % PALETTE.length] }} />
                    <span className="capitalize">{row.device}</span>
                    <span className="ml-auto pl-4 font-medium">{row.sessions}</span>
                    <span className="w-10 text-right text-black/45">{row.share}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel
          title="Sessions by landing page"
          action={<Link href="/dashboard/analytics/reports/sessions-by-landing-page" className="text-xs text-black/55 underline underline-offset-2 hover:text-black">View report</Link>}
        >
          <BarList rows={data.landingPages.slice(0, 8).map((row) => ({ label: row.path, value: row.sessions }))} />
        </Panel>
        <Panel
          title="Sessions by referrer"
          action={<Link href="/dashboard/analytics/reports/sessions-by-referrer" className="text-xs text-black/55 underline underline-offset-2 hover:text-black">View report</Link>}
        >
          <BarList rows={data.referrers.slice(0, 8).map((row) => ({ label: row.referrer, value: row.sessions }))} />
        </Panel>
        <Panel
          title="Sessions by location"
          action={<Link href="/dashboard/analytics/reports/sessions-by-location" className="text-xs text-black/55 underline underline-offset-2 hover:text-black">View report</Link>}
        >
          <BarList rows={data.countries.slice(0, 8).map((row) => ({ label: row.country, value: row.sessions }))} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel
          title="Products by views"
          action={<Link href="/dashboard/analytics/reports/products-by-views" className="text-xs text-black/55 underline underline-offset-2 hover:text-black">View report</Link>}
        >
          <BarList rows={data.topProducts.slice(0, 8).map((row) => ({ label: row.name, value: row.views, hint: row.addToCart ? `${row.addToCart} added to bag` : undefined }))} />
        </Panel>
        <Panel
          title="Searches by search query"
          action={<Link href="/dashboard/analytics/reports/searches-by-query" className="text-xs text-black/55 underline underline-offset-2 hover:text-black">View report</Link>}
        >
          <BarList rows={data.topSearches.slice(0, 8).map((row) => ({ label: row.query, value: row.searches, hint: `${row.averageResults} results` }))} />
        </Panel>
        <Panel
          title="Searches with no results"
          action={<Link href="/dashboard/analytics/reports/searches-with-no-results" className="text-xs text-black/55 underline underline-offset-2 hover:text-black">View report</Link>}
        >
          <BarList rows={data.zeroResultSearches.slice(0, 8).map((row) => ({ label: row.query, value: row.searches }))} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel
          title="Sales by traffic source"
          action={<Link href="/dashboard/analytics/reports/sales-by-channel" className="text-xs text-black/55 underline underline-offset-2 hover:text-black">View report</Link>}
        >
          <BarList
            rows={[...data.channels].filter((row) => row.sales > 0).sort((a, b) => b.sales - a.sales).slice(0, 8).map((row) => ({ label: row.label, value: row.sales }))}
            format={money}
          />
        </Panel>
        <Panel title="New vs returning visitors">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg bg-black/[0.03] p-4">
              <p className="text-2xl font-semibold text-black/80">{data.newVsReturning.newVisitors}</p>
              <p className="text-xs text-black/55">New visitors</p>
            </div>
            <div className="rounded-lg bg-black/[0.03] p-4">
              <p className="text-2xl font-semibold text-black/80">{data.newVsReturning.returningVisitors}</p>
              <p className="text-xs text-black/55">Returning visitors</p>
            </div>
          </div>
        </Panel>
        <Panel
          title="Session recordings"
          action={<Link href="/dashboard/analytics/recordings" className="text-xs text-black/55 underline underline-offset-2 hover:text-black">Watch</Link>}
        >
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg bg-black/[0.03] p-4">
              <p className="text-2xl font-semibold text-black/80">{data.recordings.count}</p>
              <p className="text-xs text-black/55">Recorded sessions</p>
            </div>
            <div className="rounded-lg bg-black/[0.03] p-4">
              <p className="text-2xl font-semibold text-black/80">{data.recordings.converted}</p>
              <p className="text-xs text-black/55">Ended in an order</p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 pb-2 text-xs text-black/50">
        <Target className="size-3.5" />
        Analytics updates as your store receives activity
        <CircleHelp className="size-3.5" />
      </div>
    </main>
  )
}
