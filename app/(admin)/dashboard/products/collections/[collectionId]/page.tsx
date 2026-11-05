import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { CollectionEditor } from "@/components/admin-dashboard/collection-editor"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  getCollectionForAdmin,
  listProductsForCollectionAssignment,
} from "@/lib/server/dal/collections"

export const metadata: Metadata = {
  title: "Edit collection | Pubesto Admin",
  description: "Edit a product collection in the Pubesto admin dashboard.",
}

export default async function EditCollectionPage({
  params,
}: PageProps<"/dashboard/products/collections/[collectionId]">) {
  const { collectionId } = await params
  const [collection, products] = await Promise.all([
    getCollectionForAdmin(collectionId),
    listProductsForCollectionAssignment(),
  ])

  if (!collection) notFound()

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset><CollectionEditor collection={collection} products={products} /></SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
