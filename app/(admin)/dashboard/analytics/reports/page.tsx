import type { Metadata } from "next"

import { ReportsList } from "@/components/admin-dashboard/analytics/reports-list"
import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { requirePermission } from "@/lib/server/dal/auth"

export const metadata: Metadata = {
  title: "Reports | Pubesto Admin",
  description: "Browse store analytics reports.",
}

export default async function ReportsPage() {
  await requirePermission("analytics.view")

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset>
          <ReportsList />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
