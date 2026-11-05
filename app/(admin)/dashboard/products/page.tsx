import type { Metadata } from "next"

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { ProductDashboard } from "@/components/admin-dashboard/product-dashboard"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { listCategoryOptionsForAdmin } from "@/lib/server/dal/categories"
import {
  listCollectionOptionsForAdmin,
  listProductsForAdmin,
} from "@/lib/server/dal/products"

export const metadata: Metadata = {
  title: "Products | Pubesto Admin",
  description: "Manage Pubesto products, collections, and inventory.",
}

export default async function ProductsPage() {
  const [products, categories, collections] = await Promise.all([
    listProductsForAdmin(),
    listCategoryOptionsForAdmin(),
    listCollectionOptionsForAdmin(),
  ])

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset>
          <ProductDashboard
            products={products}
            categories={categories}
            collections={collections}
          />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
