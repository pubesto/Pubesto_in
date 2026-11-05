import type { Metadata } from "next"

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { CategoryEditor } from "@/components/admin-dashboard/category-editor"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  listCategoryOptionsForAdmin,
  listProductsForCategoryAssignment,
} from "@/lib/server/dal/categories"

export const metadata: Metadata = { title: "Add category | Pubesto Admin" }

export default async function NewCategoryPage() {
  const [parentOptions, products] = await Promise.all([
    listCategoryOptionsForAdmin(),
    listProductsForCategoryAssignment(),
  ])

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset>
          <CategoryEditor parentOptions={parentOptions} products={products} />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
