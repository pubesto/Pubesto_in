import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { BannerEditor } from "@/components/admin-dashboard/banner-editor"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getBannerForAdmin } from "@/lib/server/dal/banners"

export const metadata: Metadata = {
  title: "Edit Banner | Pubesto Admin",
  description: "Edit homepage banner details and imagery.",
}

export default async function EditBannerPage({
  params,
}: {
  params: Promise<{ bannerId: string }>
}) {
  const { bannerId } = await params
  const banner = await getBannerForAdmin(bannerId)

  if (!banner) notFound()

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset>
          <Suspense fallback={<div className="p-8 text-xs text-neutral-500">Loading banner editor...</div>}>
            <BannerEditor banner={banner} />
          </Suspense>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
