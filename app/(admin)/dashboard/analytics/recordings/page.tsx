import type { Metadata } from "next"

import { RecordingsManager } from "@/components/admin-dashboard/analytics/recordings-manager"
import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { listRecordings } from "@/lib/server/analytics/recordings"
import { requirePermission } from "@/lib/server/dal/auth"

export const metadata: Metadata = {
  title: "Session Recordings | Pubesto Admin",
  description: "Replay anonymised visitor sessions filtered by page, device and date.",
}

export default async function RecordingsPage() {
  await requirePermission("analytics.view")
  const recordings = await listRecordings({ days: 30, page: 1, pageSize: 25 })

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset>
          <RecordingsManager initialData={recordings} />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
