import type { Metadata } from "next"

import { HeatmapViewer } from "@/components/admin-dashboard/analytics/heatmap-viewer"
import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { requirePermission } from "@/lib/server/dal/auth"
import { getHeatmapData, listHeatmapPages } from "@/lib/server/dal/heatmaps"

export const metadata: Metadata = {
  title: "Heatmaps | Pubesto Admin",
  description: "Click, movement and scroll heatmaps for every storefront page.",
}

export default async function HeatmapsPage() {
  await requirePermission("analytics.view")
  const pages = await listHeatmapPages({ days: 30 })
  const firstPath = pages[0]?.path ?? "/"
  const data = await getHeatmapData({ path: firstPath, device: "all", days: 30 })

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset>
          <HeatmapViewer initialPages={pages} initialData={data} />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
