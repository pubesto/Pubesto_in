"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { ChevronRightIcon } from "lucide-react"

function isRouteActive(pathname: string, url: string) {
  if (url === "#") return false
  if (url === "/dashboard") return pathname === url
  return pathname === url || pathname.startsWith(`${url}/`)
}

function NavMainItem({
  item,
  pathname,
}: {
  item: {
    title: string
    url: string
    icon?: React.ReactNode
    isActive?: boolean
    items?: {
      title: string
      url: string
    }[]
  }
  pathname: string
}) {
  const activeSubIndex =
    item.items?.findIndex((subItem) => isRouteActive(pathname, subItem.url)) ?? -1
  const hasActiveSubRoute = activeSubIndex >= 0
  const routeActive =
    Boolean(item.isActive) ||
    (isRouteActive(pathname, item.url) && !hasActiveSubRoute)
  const [open, setOpen] = React.useState(routeActive || hasActiveSubRoute)
  const [hoveredSubIndex, setHoveredSubIndex] = React.useState<number | null>(null)

  if (item.items?.length) {
    const hoveredConnectorIndex = hoveredSubIndex ?? -1
    const guideIndex = Math.max(activeSubIndex, hoveredConnectorIndex)
    const guideHeight = guideIndex * 28 + 24
    const guideTurnY = guideHeight - 4
    const hasHoverConnector = hoveredSubIndex !== null && hoveredSubIndex !== activeSubIndex

    const connectorTurn = (index: number, opacity = 1) => {
      const turnY = index * 28 + 20
      return (
        <g opacity={opacity}>
          <path d={`M1 ${turnY - 3} Q1 ${turnY} 4 ${turnY} H13`} />
          <path d={`M10 ${turnY - 3} L14 ${turnY} L10 ${turnY + 3}`} />
        </g>
      )
    }

    return (
      <Collapsible
        key={item.title}
        asChild
        open={open}
        onOpenChange={setOpen}
        className="group/collapsible"
      >
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={routeActive}
            tooltip={item.title}
            className={
              routeActive
                ? "text-sidebar-foreground"
                : "text-sidebar-foreground/55 hover:text-sidebar-foreground"
            }
          >
            <Link href={item.url}>
              {item.icon}
              <span>{item.title}</span>
            </Link>
          </SidebarMenuButton>
          <CollapsibleTrigger asChild>
            <SidebarMenuAction
              showOnHover
              className={
                routeActive
                  ? "text-sidebar-foreground"
                  : "text-sidebar-foreground/45 hover:text-sidebar-foreground"
              }
            >
              <ChevronRightIcon className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuAction>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub className="relative ml-3.5 -mr-2 border-l-0 pl-4">
              {guideIndex >= 0 && (
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 top-0 z-10 overflow-visible text-sidebar-foreground/45"
                  width="18"
                  height={guideHeight}
                  viewBox={`0 0 18 ${guideHeight}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {activeSubIndex >= 0 && !hasHoverConnector ? (
                    <>
                      <path
                        d={`M1 0 V${activeSubIndex * 28 + 17} Q1 ${activeSubIndex * 28 + 20} 4 ${activeSubIndex * 28 + 20} H13`}
                      />
                      <path
                        d={`M10 ${activeSubIndex * 28 + 17} L14 ${activeSubIndex * 28 + 20} L10 ${activeSubIndex * 28 + 23}`}
                      />
                    </>
                  ) : (
                    <>
                      <path d={`M1 0 V${guideTurnY - 3}`} />
                      {activeSubIndex >= 0 && connectorTurn(activeSubIndex)}
                      {hoveredSubIndex !== null && connectorTurn(hoveredSubIndex, 0.6)}
                    </>
                  )}
                </svg>
              )}
              {item.items.map((subItem, subItemIndex) => {
                const subRouteActive = isRouteActive(pathname, subItem.url)

                return (
                  <SidebarMenuSubItem
                    key={subItem.title}
                    onMouseEnter={() => setHoveredSubIndex(subItemIndex)}
                    onMouseLeave={() => setHoveredSubIndex(null)}
                  >
                    <SidebarMenuSubButton
                      asChild
                      isActive={subRouteActive}
                      className={
                        subRouteActive
                          ? "text-sidebar-foreground"
                          : "text-sidebar-foreground/55 hover:text-sidebar-foreground"
                      }
                    >
                      <Link href={subItem.url}>
                        <span>{subItem.title}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                )
              })}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={routeActive}
        tooltip={item.title}
        className={
          routeActive
            ? "text-sidebar-foreground"
            : "text-sidebar-foreground/55 hover:text-sidebar-foreground"
        }
      >
        <Link href={item.url}>
          {item.icon}
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: React.ReactNode
    isActive?: boolean
    items?: {
      title: string
      url: string
    }[]
  }[]
}) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => (
          <NavMainItem key={`${item.title}-${pathname}`} item={item} pathname={pathname} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
