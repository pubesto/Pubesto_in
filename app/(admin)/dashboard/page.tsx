import type { Metadata } from "next"
import { ShieldAlert } from "lucide-react"

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { AdminOverview } from "@/components/admin-dashboard/AdminOverview"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { PERMISSION_MODULES } from "@/lib/permissions"
import { getAdminOverviewData } from "@/lib/server/dal/overview"

export const metadata: Metadata = {
  title: "Dashboard | Pubesto Admin",
  description: "Pubesto store performance and management overview.",
}

function deniedMessage(denied: string | undefined) {
  if (!denied) return null
  if (denied === "admin") {
    return "That page is only available to full administrators."
  }
  const [moduleKey] = denied.split(".")
  const definition = PERMISSION_MODULES.find((entry) => entry.key === moduleKey)
  return definition
    ? `You don't have access to ${definition.label}. Ask an administrator to grant the "${denied}" permission.`
    : "You don't have access to that page."
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>
}) {
  const [{ denied }, initialOverview] = await Promise.all([
    searchParams,
    getAdminOverviewData(),
  ])
  const notice = deniedMessage(denied)

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset>
          {notice ? (
            <div
              role="status"
              className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:mx-5"
            >
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>{notice}</span>
            </div>
          ) : null}
          <AdminOverview initialData={initialOverview} />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
