import type { Metadata } from "next"

import { AbandonedCheckoutManager } from "@/components/admin-dashboard/abandoned-checkout-manager"
import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { listAbandonedCheckoutsForAdmin } from "@/lib/server/dal/abandoned-checkouts"

export const metadata: Metadata = {
  title: "Abandoned checkouts | Pubesto Admin",
  description: "Review active carts and create recovery orders in Pubesto.",
}

export default async function AbandonedCheckoutsPage() {
  const checkouts = await listAbandonedCheckoutsForAdmin()
  return <TooltipProvider><SidebarProvider className="min-h-svh"><AppSidebar /><SidebarInset><AbandonedCheckoutManager checkouts={checkouts} /></SidebarInset></SidebarProvider></TooltipProvider>
}
