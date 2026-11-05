import type { Metadata } from "next"

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { StaffManager } from "@/components/admin-dashboard/staff-manager"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { listStaffForAdmin } from "@/lib/server/dal/staff"

export const metadata: Metadata = {
  title: "Staff & Permissions | Pubesto Admin",
  description: "Add sub-admins and decide exactly which parts of the dashboard each one can use.",
}

export default async function StaffPage() {
  const staff = await listStaffForAdmin()

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset>
          <StaffManager initialStaff={staff} />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
