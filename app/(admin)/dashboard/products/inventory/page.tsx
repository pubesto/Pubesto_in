import type { Metadata } from "next"

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { InventoryManager } from "@/components/admin-dashboard/inventory-manager"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { listInventoryForAdmin } from "@/lib/server/dal/inventory"

export const metadata: Metadata = {
  title: "Inventory | Pubesto Admin",
  description: "Manage inventory levels for Pubesto products.",
}

export default async function InventoryPage() {
  const inventory = await listInventoryForAdmin()

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset><InventoryManager initialItems={inventory} /></SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
