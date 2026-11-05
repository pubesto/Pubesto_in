import type { Metadata } from "next"

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { DraftManager } from "@/components/admin-dashboard/draft-manager"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { listDraftsForAdmin } from "@/lib/server/dal/drafts"

export const metadata: Metadata = {
  title: "Drafts | Pubesto Admin",
  description: "Create and manage draft orders and invoices in Pubesto.",
}

export default async function DraftsPage() {
  const drafts = await listDraftsForAdmin()

  return <TooltipProvider><SidebarProvider className="min-h-svh"><AppSidebar /><SidebarInset><DraftManager drafts={drafts} /></SidebarInset></SidebarProvider></TooltipProvider>
}
