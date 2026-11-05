"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowDownUp, ChevronDown, FileChartColumn, Search } from "lucide-react"

import { REPORT_DEFINITIONS, type ReportCategory } from "@/lib/analytics/reports"

const CATEGORIES: Array<ReportCategory | "All"> = ["All", "Acquisition", "Behavior", "Sales", "Search"]

export function ReportsList() {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<ReportCategory | "All">("All")
  const [sortAsc, setSortAsc] = useState(true)

  const reports = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return REPORT_DEFINITIONS.filter(
      (report) =>
        (category === "All" || report.category === category) &&
        (!needle || report.name.toLowerCase().includes(needle) || report.description.toLowerCase().includes(needle)),
    ).sort((a, b) => (sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)))
  }, [query, category, sortAsc])

  return (
    <main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <FileChartColumn className="size-4" />
          Reports
        </h1>
        <Link
          href="/dashboard/analytics"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-black px-3 text-xs font-medium text-white hover:bg-black/80"
        >
          Back to analytics
        </Link>
      </div>

      <section className="mt-3 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-black/10 px-4 py-2">
          <Search className="size-4 text-black/50" />
          <input
            aria-label="Search reports"
            placeholder="Search reports"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-black/50"
          />
          <button
            type="button"
            aria-label="Sort reports"
            onClick={() => setSortAsc((value) => !value)}
            className="rounded-lg border border-black/10 p-1.5 text-black/55 hover:bg-black/[0.03]"
          >
            <ArrowDownUp className="size-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-black/10 px-4 py-2">
          {CATEGORIES.map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setCategory(entry)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
                category === entry ? "border-black bg-black text-white" : "border-dashed border-black/15 text-black/70"
              }`}
            >
              {entry === "All" ? "Category" : entry}
              {entry === "All" ? <ChevronDown className="size-3.5" /> : null}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="bg-black/[0.025] text-xs text-black/65">
              <tr>
                <th className="border-b border-black/10 px-3 py-2.5 font-medium">Name</th>
                <th className="border-b border-black/10 px-3 py-2.5 font-medium">Category</th>
                <th className="border-b border-black/10 px-3 py-2.5 font-medium">What it shows</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.slug} className="hover:bg-black/[0.02]">
                  <td className="border-b border-black/10 px-3 py-2">
                    <Link
                      href={`/dashboard/analytics/reports/${report.slug}`}
                      className="text-blue-700 underline-offset-2 hover:underline"
                    >
                      {report.name}
                    </Link>
                  </td>
                  <td className="border-b border-black/10 px-3 py-2">
                    <span className="rounded-full bg-black/[0.07] px-2 py-1 text-xs text-black/60">{report.category}</span>
                  </td>
                  <td className="border-b border-black/10 px-3 py-2 text-black/60">{report.description}</td>
                </tr>
              ))}
              {!reports.length ? (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-sm text-black/55">
                    No reports match your search.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="border-t border-black/10 px-3 py-2 text-xs text-black/60">
          {reports.length} {reports.length === 1 ? "report" : "reports"}
        </div>
      </section>
    </main>
  )
}
