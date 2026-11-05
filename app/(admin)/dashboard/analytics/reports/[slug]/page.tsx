import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ReportView } from "@/components/admin-dashboard/analytics/report-view"
import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { findReport } from "@/lib/analytics/reports"
import { getReport } from "@/lib/server/dal/analytics"
import { requirePermission } from "@/lib/server/dal/auth"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const definition = findReport(slug)
  return { title: `${definition?.name ?? "Report"} | Pubesto Admin` }
}

export default async function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  await requirePermission("analytics.view")
  const { slug } = await params
  const report = await getReport(slug, { preset: "Last 30 days" })
  if (!report) notFound()

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset>
          <ReportView initialReport={report} />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
