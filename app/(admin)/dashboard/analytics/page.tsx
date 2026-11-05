import type { Metadata } from "next"

import { AnalyticsDashboard } from "@/components/admin-dashboard/analytics/analytics-dashboard"
import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getStoreAnalytics } from "@/lib/server/dal/analytics"
import { requirePermission } from "@/lib/server/dal/auth"

export const metadata: Metadata = {
  title: "Analytics | Pubesto Admin",
  description: "Review sales, traffic sources, behaviour and search analytics.",
}

export default async function AnalyticsPage() {
  await requirePermission("analytics.view")
  const analytics = await getStoreAnalytics({ preset: "Last 30 days" })

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset>
          <AnalyticsDashboard initialData={analytics} />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
