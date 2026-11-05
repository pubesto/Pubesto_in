import type { Metadata } from "next"

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { CollectionManager } from "@/components/admin-dashboard/collection-manager"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { listCollectionsForAdmin } from "@/lib/server/dal/collections"

export const metadata: Metadata = {
  title: "Collections | Pubesto Admin",
  description: "Manage product collections in the Pubesto admin dashboard.",
}

export default async function CollectionsPage() {
  const collections = await listCollectionsForAdmin()

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset><CollectionManager initialCollections={collections} /></SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
