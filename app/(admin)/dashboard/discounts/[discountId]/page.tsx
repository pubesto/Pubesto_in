import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { DiscountEditor } from "@/components/admin-dashboard/discount-editor"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getDiscountForAdmin, listDiscountEditorOptionsForAdmin } from "@/lib/server/dal/discounts"

export const metadata: Metadata = { title: "Edit discount | Pubesto Admin", description: "Edit a Pubesto discount." }

export default async function EditDiscountPage({ params }: PageProps<"/dashboard/discounts/[discountId]">) {
  const { discountId } = await params
  const [discount, options] = await Promise.all([getDiscountForAdmin(discountId), listDiscountEditorOptionsForAdmin()])
  if (!discount) notFound()
  return <TooltipProvider><SidebarProvider className="min-h-svh"><AppSidebar /><SidebarInset><DiscountEditor type={discount.type} products={options.products} collections={options.collections} initial={discount} /></SidebarInset></SidebarProvider></TooltipProvider>
}
