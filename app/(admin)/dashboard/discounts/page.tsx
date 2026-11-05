import type { Metadata } from "next"

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { DiscountManager } from "@/components/admin-dashboard/discount-manager"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { listDiscountsForAdmin } from "@/lib/server/dal/discounts"

export const metadata: Metadata = {
  title: "Discounts | Pubesto Admin",
  description: "Create and manage Pubesto discounts and automatic offers.",
}

export default async function DiscountsPage() {
  const discounts = await listDiscountsForAdmin()
  return <TooltipProvider><SidebarProvider className="min-h-svh"><AppSidebar /><SidebarInset><DiscountManager discounts={discounts} /></SidebarInset></SidebarProvider></TooltipProvider>
}
