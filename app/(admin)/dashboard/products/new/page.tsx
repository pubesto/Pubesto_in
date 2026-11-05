import type { Metadata } from "next"

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { ProductEditor } from "@/components/admin-dashboard/product-editor"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { listCategoryOptionsForAdmin } from "@/lib/server/dal/categories"
import { listDiscountCodeOptionsForAdmin } from "@/lib/server/dal/discounts"
import { listCollectionOptionsForAdmin, listProductOptionsForAdmin } from "@/lib/server/dal/products"

export const metadata: Metadata = {
  title: "Add product | Pubesto Admin",
  description: "Create a new product in the Pubesto admin dashboard.",
}

export default async function AddProductPage() {
  const [categories, collections, productOptions, discountCodes] = await Promise.all([
    listCategoryOptionsForAdmin(),
    listCollectionOptionsForAdmin(),
    listProductOptionsForAdmin(),
    listDiscountCodeOptionsForAdmin(),
  ])

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset>
          <ProductEditor
            categories={categories}
            collections={collections}
            productOptions={productOptions}
            discountCodes={discountCodes}
          />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
