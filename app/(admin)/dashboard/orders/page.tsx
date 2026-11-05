import type { Metadata } from "next"

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { OrderManager } from "@/components/admin-dashboard/order-manager"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { listOrdersForAdmin } from "@/lib/server/dal/orders"

export const metadata: Metadata = {
  title: "Orders | Pubesto Admin",
  description: "Manage Pubesto orders and fulfillment.",
}

export default async function OrdersPage() {
  const dashboard = await listOrdersForAdmin()

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset>
          <OrderManager dashboard={dashboard} />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
