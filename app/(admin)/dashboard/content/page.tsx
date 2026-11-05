import type { Metadata } from "next"

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { ContentManager } from "@/components/admin-dashboard/content-manager"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getSiteContentForAdmin } from "@/lib/server/dal/site-content"

export const metadata: Metadata = {
  title: "Website Content | Pubesto Admin",
  description: "Edit announcements, the launch offer, carousels, contact details, FAQs and policies.",
}

export const dynamic = "force-dynamic"

export default async function ContentPage() {
  const view = await getSiteContentForAdmin()

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset>
          <ContentManager initial={view} />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
