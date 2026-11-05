import type { Metadata } from "next"

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { ReturnManager } from "@/components/admin-dashboard/return-manager"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { hasPermission } from "@/lib/permissions"
import { requirePermission } from "@/lib/server/dal/auth"
import { listCancellationRequestsForAdmin, listReturnRequestsForAdmin } from "@/lib/server/dal/returns"

export const metadata: Metadata = {
  title: "Returns & cancellations | Pubesto Admin",
  description: "Review customer return and order cancellation requests.",
}

export default async function ReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const user = await requirePermission("returns.view")
  const [returns, cancellations, params] = await Promise.all([
    listReturnRequestsForAdmin(),
    listCancellationRequestsForAdmin(),
    searchParams,
  ])
  const initialTab = params.tab === "cancellations" ? "cancellations" : "returns"

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset>
          <ReturnManager
            returns={returns}
            cancellations={cancellations}
            initialTab={initialTab}
            canManage={hasPermission(user, "returns.manage")}
          />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
