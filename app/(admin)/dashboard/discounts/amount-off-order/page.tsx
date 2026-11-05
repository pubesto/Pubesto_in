import type { Metadata } from "next"

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { DiscountEditor } from "@/components/admin-dashboard/discount-editor"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { listDiscountEditorOptionsForAdmin } from "@/lib/server/dal/discounts"

export const metadata: Metadata = { title: "Create order discount | Pubesto Admin", description: "Create an amount-off-order discount for Pubesto." }

export default async function AmountOffOrderPage() {
  const { products, collections } = await listDiscountEditorOptionsForAdmin()
  return <TooltipProvider><SidebarProvider className="min-h-svh"><AppSidebar /><SidebarInset><DiscountEditor type="ORDER" products={products} collections={collections} /></SidebarInset></SidebarProvider></TooltipProvider>
}
