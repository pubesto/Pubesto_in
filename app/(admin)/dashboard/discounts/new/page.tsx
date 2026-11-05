import type { Metadata } from "next"

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { DiscountEditor } from "@/components/admin-dashboard/discount-editor"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { listDiscountEditorOptionsForAdmin } from "@/lib/server/dal/discounts"

export const metadata: Metadata = { title: "Create product discount | Pubesto Admin", description: "Create an amount-off-products discount for Pubesto." }

export default async function CreateProductDiscountPage() {
  const { products, collections } = await listDiscountEditorOptionsForAdmin()
  return <TooltipProvider><SidebarProvider className="min-h-svh"><AppSidebar /><SidebarInset><DiscountEditor type="PRODUCT" products={products} collections={collections} /></SidebarInset></SidebarProvider></TooltipProvider>
}
