import type { Metadata } from "next"

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { ReviewManager } from "@/components/admin-dashboard/review-manager"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { hasPermission } from "@/lib/permissions"
import { requirePermission } from "@/lib/server/dal/auth"
import { listReviewProductOptionsForAdmin, listReviewsForAdmin } from "@/lib/server/dal/reviews"

export const metadata: Metadata = {
  title: "Reviews | Pubesto Admin",
  description: "Approve, feature and edit Pubesto customer reviews.",
}

export default async function ReviewsPage() {
  const user = await requirePermission("reviews.view")
  const [reviews, products] = await Promise.all([listReviewsForAdmin(), listReviewProductOptionsForAdmin()])

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset>
          <ReviewManager
            reviews={reviews}
            products={products}
            canManage={hasPermission(user, "reviews.manage")}
            canDelete={hasPermission(user, "reviews.delete")}
          />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
