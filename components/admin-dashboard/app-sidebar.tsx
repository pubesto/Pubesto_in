"use client"

import * as React from "react"
import Image from "next/image"

import { getStaffAccessAction, type StaffAccess } from "@/app/actions/staff"
import { NavMain } from "@/components/admin-dashboard/nav-main"
import { NavUser } from "@/components/admin-dashboard/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { authClient } from "@/lib/auth-client"
import { canOpenRoute } from "@/lib/permissions"
import {
  HomeIcon,
  BadgePercentIcon,
  InboxIcon,
  ChartNoAxesCombinedIcon,
  PackageIcon,
  UsersRoundIcon,
  ImageIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
  StarIcon,
  Undo2Icon,
  MailIcon,
} from "lucide-react"

type NavItem = {
  title: string
  url: string
  icon?: React.ReactNode
  items?: { title: string; url: string }[]
}

const navMain: NavItem[] = [
  {
    title: "Home",
    url: "/dashboard",
    icon: <HomeIcon />,
  },
  {
    title: "Banners",
    url: "/dashboard/banners",
    icon: <ImageIcon />,
  },
  {
    title: "Orders",
    url: "/dashboard/orders",
    icon: <InboxIcon />,
    items: [
      {
        title: "Drafts",
        url: "/dashboard/orders/drafts",
      },
      {
        title: "Abandoned checkouts",
        url: "/dashboard/orders/abandoned-checkouts",
      },
    ],
  },
  {
    title: "Products",
    url: "/dashboard/products",
    icon: <PackageIcon />,
    items: [
      { title: "Collections", url: "/dashboard/products/collections" },
      { title: "Categories", url: "/dashboard/products/categories" },
      { title: "Inventory", url: "/dashboard/products/inventory" },
    ],
  },
  {
    title: "Customers",
    url: "/dashboard/customers",
    icon: <UsersRoundIcon />,
  },
  {
    title: "Reviews",
    url: "/dashboard/reviews",
    icon: <StarIcon />,
  },
  {
    title: "Returns & cancellations",
    url: "/dashboard/returns",
    icon: <Undo2Icon />,
  },
  {
    title: "Messages",
    url: "/dashboard/messages",
    icon: <MailIcon />,
  },
  {
    title: "Discounts",
    url: "/dashboard/discounts",
    icon: <BadgePercentIcon />,
  },
  {
    title: "Analytics",
    url: "/dashboard/analytics",
    icon: <ChartNoAxesCombinedIcon />,
    items: [
      {
        title: "Reports",
        url: "/dashboard/analytics/reports",
      },
      {
        title: "Recordings",
        url: "/dashboard/analytics/recordings",
      },
      {
        title: "Heatmaps",
        url: "/dashboard/analytics/heatmaps",
      },
    ],
  },
  {
    title: "Taxes & GST",
    url: "/dashboard/taxes",
    icon: <ReceiptTextIcon />,
  },
  {
    title: "Staff & permissions",
    url: "/dashboard/settings/staff",
    icon: <ShieldCheckIcon />,
  },
]

/**
 * Keeps only the modules the signed-in staff member may open. The parent
 * "Products" entry stays when any of its sub-pages is allowed, even if the
 * products list itself is not.
 */
function filterNav(items: NavItem[], access: StaffAccess): NavItem[] {
  return items.flatMap((item) => {
    if (item.url === "/dashboard") return [item]

    const subItems = item.items?.filter((sub) => canOpenRoute(access, sub.url)) ?? []
    const parentAllowed = canOpenRoute(access, item.url)

    if (!parentAllowed && subItems.length === 0) return []

    return [
      {
        ...item,
        // Send the parent link to the first allowed sub-page when the parent
        // list itself is off-limits.
        url: parentAllowed ? item.url : subItems[0]!.url,
        items: item.items ? subItems : undefined,
      },
    ]
  })
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = authClient.useSession()
  const sessionRole = session?.user.role
  const [access, setAccess] = React.useState<StaffAccess | null>(null)

  React.useEffect(() => {
    let cancelled = false
    getStaffAccessAction().then((result) => {
      if (!cancelled) setAccess(result)
    })
    return () => {
      cancelled = true
    }
  }, [sessionRole])

  const items = React.useMemo(() => {
    // Administrators see everything immediately; sub-admins wait for their
    // permission list so restricted modules never flash into view.
    if (sessionRole === "ADMIN" && !access) {
      return filterNav(navMain, { role: "ADMIN", permissions: [] })
    }
    if (!access) {
      return navMain.filter((item) => item.url === "/dashboard")
    }
    return filterNav(navMain, access)
  }, [access, sessionRole])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 group-data-[collapsible=icon]:px-0">
          <Image
            src="/favicon.png"
            alt="Pubesto"
            width={32}
            height={32}
            className="size-8 shrink-0 rounded-lg object-contain"
          />
          <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-semibold">Pubesto</span>
            <span className="truncate text-xs text-sidebar-foreground/65">
              {access?.role === "SUB_ADMIN" ? "Staff Dashboard" : "Admin Dashboard"}
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={items} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
