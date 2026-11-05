import type { Metadata } from "next"

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { CustomerManager } from "@/components/admin-dashboard/customer-manager"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { listCustomersForAdmin } from "@/lib/server/dal/customers"

export const metadata: Metadata = {
  title: "Customers | Pubesto Admin",
  description: "Review customer profiles, orders, and spending in Pubesto.",
}

export default async function CustomersPage() {
  const customers = await listCustomersForAdmin()

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset>
          <CustomerManager initialCustomers={customers} />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
