"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ChevronLeft, Download, Loader2 } from "lucide-react"

import { fetchReportAction } from "@/app/actions/analytics"
import {
  DateRangePicker,
  type AnalyticsRangeSelection,
} from "@/components/admin-dashboard/analytics/date-range-picker"
import type { ReportColumn, ReportResult } from "@/lib/analytics/reports"

const BLUE = "#08a7f5"

function formatCell(value: string | number | null, format: ReportColumn["format"]) {
  if (value === null || value === undefined) return "—"
  if (typeof value === "string") return value
  switch (format) {
    case "currency":
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value)
    case "percent":
      return `${Number.isInteger(value) ? value : value.toFixed(2)}%`
    case "duration":
      return `${Math.round(value / 1000)}s`
    default:
      return value.toLocaleString("en-IN")
  }
}

function toCsv(report: ReportResult) {
  const header = report.columns.map((column) => `"${column.label}"`).join(",")
  const lines = report.rows.map((row) =>
    report.columns
      .map((column) => {
        const value = row[column.key]
        return `"${String(value ?? "").replace(/"/g, '""')}"`
      })
      .join(","),
  )
  return [header, ...lines].join("\n")
}

export function ReportView({ initialReport }: { initialReport: ReportResult }) {
  const [report, setReport] = useState(initialReport)
  const [rangeLabel, setRangeLabel] = useState(initialReport.rangeLabel)
  const [isPending, startTransition] = useTransition()

  function changeRange(selection: AnalyticsRangeSelection, label: string) {
    setRangeLabel(label)
    startTransition(async () => {
      const result = await fetchReportAction(report.slug, selection)
      if (result.success) setReport(result.data)
    })
  }

  function download() {
    const blob = new Blob([toCsv(report)], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${report.slug}-${rangeLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const chart = report.chart
  const chartFormat = chart?.series[0]?.format

  return (
    <main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/analytics/reports"
            aria-label="Back to reports"
            className="rounded-lg bg-black/[0.06] p-2 text-black/65 hover:bg-black/10"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              {report.name}
              {isPending ? <Loader2 className="size-4 animate-spin text-black/40" /> : null}
            </h1>
            <p className="text-xs text-black/55">{report.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker label={rangeLabel} onChange={changeRange} />
          <button
            type="button"
            onClick={download}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-black/15 bg-white px-3 text-xs font-medium hover:bg-black/[0.03]"
          >
            <Download className="size-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {report.summary.length ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {report.summary.map((item) => (
            <section key={item.label} className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
              <p className="w-fit border-b border-dotted border-black/55 text-sm font-medium capitalize text-black/75">{item.label}</p>
              <p className="mt-1 text-lg font-semibold text-black/80">{item.value}</p>
              <div className="mt-2 h-0.5 w-11 bg-[#55c5f7]" />
            </section>
          ))}
        </div>
      ) : null}

      {chart && report.rows.length ? (
        <section className="mt-4 rounded-xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="h-[300px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 320, height: 300 }}>
              {chart.type === "line" ? (
                <LineChart data={report.rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#e5e5e5" vertical={false} />
                  <XAxis dataKey={chart.xKey} axisLine={false} tickLine={false} tick={{ fill: "#737373", fontSize: 11 }} dy={8} minTickGap={24} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#737373", fontSize: 11 }} width={48} tickFormatter={(value) => formatCell(Number(value), chartFormat)} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e5e5", fontSize: 12 }} formatter={(value: unknown) => [formatCell(Number(value) || 0, chartFormat), ""]} />
                  {chart.series.map((series, index) => (
                    <Line
                      key={series.key}
                      type="monotone"
                      dataKey={series.key}
                      name={series.label}
                      stroke={series.color ?? BLUE}
                      strokeWidth={index === 0 ? 1.8 : 1.5}
                      strokeDasharray={index === 0 ? undefined : "4 4"}
                      dot={false}
                    />
                  ))}
                </LineChart>
              ) : (
                <BarChart data={report.rows.slice(0, 20)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#e5e5e5" vertical={false} />
                  <XAxis dataKey={chart.xKey} axisLine={false} tickLine={false} tick={{ fill: "#737373", fontSize: 10 }} dy={8} interval={0} angle={report.rows.length > 6 ? -20 : 0} height={report.rows.length > 6 ? 60 : 30} textAnchor={report.rows.length > 6 ? "end" : "middle"} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#737373", fontSize: 11 }} width={48} tickFormatter={(value) => formatCell(Number(value), chartFormat)} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e5e5", fontSize: 12 }} formatter={(value: unknown) => [formatCell(Number(value) || 0, chartFormat), ""]} />
                  {chart.series.map((series) => (
                    <Bar key={series.key} dataKey={series.key} name={series.label} fill={series.color ?? BLUE} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      <section className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead className="bg-black/[0.025] text-xs text-black/65">
              <tr>
                {report.columns.map((column) => (
                  <th
                    key={column.key}
                    className={`border-b border-black/10 px-3 py-2.5 font-medium ${column.align === "right" ? "text-right" : ""}`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, index) => (
                <tr key={index} className="hover:bg-black/[0.02]">
                  {report.columns.map((column) => (
                    <td
                      key={column.key}
                      className={`border-b border-black/10 px-3 py-2 text-black/80 ${column.align === "right" ? "text-right tabular-nums" : ""}`}
                    >
                      {formatCell(row[column.key] ?? null, column.format)}
                    </td>
                  ))}
                </tr>
              ))}
              {!report.rows.length ? (
                <tr>
                  <td colSpan={report.columns.length} className="px-3 py-10 text-center text-sm text-black/55">
                    No data for this date range
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
