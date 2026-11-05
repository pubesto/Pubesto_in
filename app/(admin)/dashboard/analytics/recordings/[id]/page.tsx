import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { RecordingPlayer } from "@/components/admin-dashboard/analytics/recording-player"
import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getRecordingDetail } from "@/lib/server/analytics/recordings"
import { requirePermission } from "@/lib/server/dal/auth"

export const metadata: Metadata = {
  title: "Session Replay | Pubesto Admin",
}

export default async function RecordingPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("analytics.view")
  const { id } = await params
  const detail = await getRecordingDetail(id)
  if (!detail) notFound()

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset>
          <RecordingPlayer detail={detail} />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
