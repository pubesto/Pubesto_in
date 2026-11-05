import type { Metadata } from "next"

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { CategoryManager } from "@/components/admin-dashboard/category-manager"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { listCategoriesForAdmin } from "@/lib/server/dal/categories"

export const metadata: Metadata = {
  title: "Categories | Pubesto Admin",
  description: "Create and manage storefront product categories.",
}

export default async function CategoriesPage() {
  const categories = await listCategoriesForAdmin()

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset>
          <CategoryManager initialCategories={categories} />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
