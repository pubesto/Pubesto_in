import type { Metadata } from "next"

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { BannerManager } from "@/components/admin-dashboard/banner-manager"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { listBannersForAdmin } from "@/lib/server/dal/banners"

export const metadata: Metadata = {
  title: "Banners | Pubesto Admin",
  description: "Manage homepage banners in the Pubesto admin dashboard.",
}

export default async function BannersPage() {
  const banners = await listBannersForAdmin()

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset>
          <BannerManager initialBanners={banners} />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
