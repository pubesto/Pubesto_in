import type { Metadata } from "next"

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { MessageManager } from "@/components/admin-dashboard/message-manager"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { hasPermission } from "@/lib/permissions"
import { requirePermission } from "@/lib/server/dal/auth"
import { listContactMessagesForAdmin } from "@/lib/server/dal/messages"

export const metadata: Metadata = {
  title: "Messages | Pubesto Admin",
  description: "Read and resolve messages sent through the Pubesto contact form.",
}

export default async function MessagesPage() {
  const user = await requirePermission("messages.view")
  const messages = await listContactMessagesForAdmin()

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset>
          <MessageManager messages={messages} canManage={hasPermission(user, "messages.manage")} />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
