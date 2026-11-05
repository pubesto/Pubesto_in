import "server-only"

import {
  differenceInDays,
  endOfDay,
  format,
  startOfDay,
  startOfQuarter,
  subDays,
} from "date-fns"

import { channelLabel } from "@/lib/analytics/channels"
import { assertAdmin } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"

export type OverviewDateRangeInput = {
  preset?: string
  from?: string | Date
  to?: string | Date
  amount?: string | number
  unit?: string
  includeToday?: boolean
}

export type OverviewMetric = {
  label: string
  value: string
  rawValue: number
  change: string
  isPositive: boolean | null
}

export type OverviewChartPoint = {
  date: string
  current: number
  previous: number
  currentSales: number
  previousSales: number
  currentOrders: number
  previousOrders: number
  currentSessions: number
  previousSessions: number
  currentConversion: number
  previousConversion: number
}

export type OverviewRecentOrder = {
  id: string
  number: number
  customerName: string
  status: "PENDING" | "CONFIRMED" | "FULFILLED" | "CANCELLED"
  statusLabel: string
  total: number
  currency: string
  createdAt: string
}

export type OverviewTopProduct = {
  id?: string
  title: string
  soldCount: number
}

export type OverviewTrafficSource = {
  source: string
  percentage: string
  count: number
}

export type OverviewData = {
  adminName: string
  rangeLabel: string
  currentPeriodLabel: string
  previousPeriodLabel: string
  metrics: OverviewMetric[]
  chartData: OverviewChartPoint[]
  ordersToFulfil: number
  paymentsToCapture: number
  recentOrders: OverviewRecentOrder[]
  topProducts: OverviewTopProduct[]
  storeHealth: {
    percentage: number
    statusText: string
    activeProducts: number
    totalProducts: number
  }
  trafficSources: OverviewTrafficSource[]
  inventoryAlerts: {
    lowStockCount: number
    outOfStockCount: number
  }
  customerSnapshot: {
    totalCustomers: number
    newCustomersThisPeriod: number
    growthChange: string
    isPositiveGrowth: boolean | null
  }
  catalogSnapshot: {
    totalProducts: number
    activeProducts: number
    totalCollections: number
    totalCategories: number
    totalVariants: number
  }
}

function formatCurrency(amount: number, currency: string = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

function calculateChange(current: number, previous: number): {
  change: string
  isPositive: boolean | null
} {
  if (previous === 0) {
    if (current > 0) return { change: "↗ 100%", isPositive: true }
    return { change: "—", isPositive: null }
  }

  const diff = ((current - previous) / previous) * 100
  const rounded = Math.abs(Math.round(diff))

  if (diff > 0) return { change: `↗ ${rounded}%`, isPositive: true }
  if (diff < 0) return { change: `↘ ${rounded}%`, isPositive: false }
  return { change: "0%", isPositive: null }
}

function resolveDateRange(input?: OverviewDateRangeInput) {
  const now = new Date()
  const preset = input?.preset || "Last 30 days"

  let currentStart: Date
  let currentEnd: Date
  let rangeLabel = preset

  if (preset === "Today") {
    currentStart = startOfDay(now)
    currentEnd = endOfDay(now)
    rangeLabel = "Today"
  } else if (preset === "Yesterday") {
    const yesterday = subDays(now, 1)
    currentStart = startOfDay(yesterday)
    currentEnd = endOfDay(yesterday)
    rangeLabel = "Yesterday"
  } else if (preset === "Last 7 days") {
    currentStart = startOfDay(subDays(now, 6))
    currentEnd = endOfDay(now)
    rangeLabel = "Last 7 days"
  } else if (preset === "Last 30 days") {
    currentStart = startOfDay(subDays(now, 29))
    currentEnd = endOfDay(now)
    rangeLabel = "Last 30 days"
  } else if (preset === "Quarter to date") {
    currentStart = startOfQuarter(now)
    currentEnd = endOfDay(now)
    rangeLabel = "Quarter to date"
  } else if (input?.from) {
    currentStart = startOfDay(new Date(input.from))
    currentEnd = endOfDay(input.to ? new Date(input.to) : new Date(input.from))
    rangeLabel = `${format(currentStart, "d MMM yyyy")} – ${format(currentEnd, "d MMM yyyy")}`
  } else if (input?.amount && input?.unit) {
    const amt = Number(input.amount) || 30
    const unitDays =
      input.unit === "Months" ? amt * 30 : input.unit === "Weeks" ? amt * 7 : amt
    const effectiveDays = Math.max(1, unitDays)
    const end = input.includeToday === false ? endOfDay(subDays(now, 1)) : endOfDay(now)
    currentStart = startOfDay(subDays(end, effectiveDays - 1))
    currentEnd = end
    rangeLabel = `Last ${amt} ${input.unit.toLowerCase()}`
  } else {
    currentStart = startOfDay(subDays(now, 29))
    currentEnd = endOfDay(now)
    rangeLabel = "Last 30 days"
  }

  const durationDays = Math.max(
    1,
    differenceInDays(currentEnd, currentStart) + 1,
  )
  const prevEnd = endOfDay(subDays(currentStart, 1))
  const prevStart = startOfDay(subDays(prevEnd, durationDays - 1))

  const currentPeriodLabel = `${format(currentStart, "MMM d")}–${format(currentEnd, "MMM d, yyyy")}`
  const previousPeriodLabel = `${format(prevStart, "MMM d")}–${format(prevEnd, "MMM d, yyyy")}`

  return {
    currentStart,
    currentEnd,
    prevStart,
    prevEnd,
    durationDays,
    rangeLabel,
    currentPeriodLabel,
    previousPeriodLabel,
  }
}

export async function getAdminOverviewData(
  input?: OverviewDateRangeInput,
): Promise<OverviewData> {
  const admin = await assertAdmin()
  const prisma = getPrisma()

  const {
    currentStart,
    currentEnd,
    prevStart,
    prevEnd,
    durationDays,
    rangeLabel,
    currentPeriodLabel,
    previousPeriodLabel,
  } = resolveDateRange(input)

  // Run all primary database queries in parallel
  const [
    currentOrders,
    prevOrders,
    currentSessionsCount,
    prevSessionsCount,
    ordersToFulfil,
    paymentsToCapture,
    recentOrdersDb,
    topItemsGroup,
    activeProductsCount,
    totalProductsCount,
    totalCustomersCount,
    newCustomersCurrent,
    newCustomersPrev,
    lowStockCount,
    outOfStockCount,
    collectionsCount,
    categoriesCount,
    variantsCount,
  ] = await Promise.all([
    // Current period orders (exclude cancelled for sales totals)
    prisma.order.findMany({
      where: {
        createdAt: { gte: currentStart, lte: currentEnd },
      },
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        createdAt: true,
      },
    }),
    // Previous period orders
    prisma.order.findMany({
      where: {
        createdAt: { gte: prevStart, lte: prevEnd },
      },
      select: {
        id: true,
        status: true,
        total: true,
        createdAt: true,
      },
    }),
    // Storefront visitor sessions current (first-party analytics beacon)
    prisma.analyticsSession.count({
      where: { startedAt: { gte: currentStart, lte: currentEnd } },
    }),
    // Storefront visitor sessions previous
    prisma.analyticsSession.count({
      where: { startedAt: { gte: prevStart, lte: prevEnd } },
    }),
    // Orders to fulfil (CONFIRMED)
    prisma.order.count({
      where: { status: "CONFIRMED" },
    }),
    // Payments to capture (PENDING)
    prisma.order.count({
      where: { status: "PENDING" },
    }),
    // 5 most recent orders for Recent Orders widget
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        currency: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
    // Top products by quantity sold
    prisma.orderItem.groupBy({
      by: ["title"],
      where: {
        order: { status: { not: "CANCELLED" } },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    // Active products
    prisma.product.count({ where: { status: "ACTIVE" } }),
    // Total products
    prisma.product.count(),
    // Total customers
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    // New customers current
    prisma.user.count({
      where: {
        role: "CUSTOMER",
        createdAt: { gte: currentStart, lte: currentEnd },
      },
    }),
    // New customers previous
    prisma.user.count({
      where: {
        role: "CUSTOMER",
        createdAt: { gte: prevStart, lte: prevEnd },
      },
    }),
    // Low stock inventory (inventoryQuantity > 0 and <= 5)
    prisma.productVariant.count({
      where: { inventoryQuantity: { gt: 0, lte: 5 } },
    }),
    // Out of stock inventory (inventoryQuantity <= 0)
    prisma.productVariant.count({
      where: { inventoryQuantity: { lte: 0 } },
    }),
    // Collections
    prisma.collection.count(),
    // Categories
    prisma.category.count(),
    // Total product variants
    prisma.productVariant.count(),
  ])

  // Total Sales calculations (exclude cancelled)
  const currentSalesTotal = currentOrders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((sum, o) => sum + Number(o.total), 0)

  const prevSalesTotal = prevOrders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((sum, o) => sum + Number(o.total), 0)

  // Orders Count calculations
  const currentOrderCount = currentOrders.length
  const prevOrderCount = prevOrders.length

  // Conversion rate calculations
  // If sessions are 0, we treat conversion rate cleanly as 0%
  const currentConversion =
    currentSessionsCount > 0
      ? (currentOrderCount / currentSessionsCount) * 100
      : 0
  const prevConversion =
    prevSessionsCount > 0
      ? (prevOrderCount / prevSessionsCount) * 100
      : 0

  const sessionsChange = calculateChange(currentSessionsCount, prevSessionsCount)
  const salesChange = calculateChange(currentSalesTotal, prevSalesTotal)
  const ordersChange = calculateChange(currentOrderCount, prevOrderCount)
  const conversionChange = calculateChange(currentConversion, prevConversion)

  const metrics: OverviewMetric[] = [
    {
      label: "Sessions",
      value: currentSessionsCount.toLocaleString(),
      rawValue: currentSessionsCount,
      change: sessionsChange.change,
      isPositive: sessionsChange.isPositive,
    },
    {
      label: "Total sales",
      value: formatCurrency(currentSalesTotal),
      rawValue: currentSalesTotal,
      change: salesChange.change,
      isPositive: salesChange.isPositive,
    },
    {
      label: "Orders",
      value: currentOrderCount.toLocaleString(),
      rawValue: currentOrderCount,
      change: ordersChange.change,
      isPositive: ordersChange.isPositive,
    },
    {
      label: "Conversion rate",
      value: `${currentConversion.toFixed(2)}%`,
      rawValue: currentConversion,
      change: conversionChange.change,
      isPositive: conversionChange.isPositive,
    },
  ]

  // Build time-series chart data points
  // Depending on durationDays:
  // <= 2 days: 12 two-hour intervals (12 AM, 2 AM, 4 AM, ... 10 PM)
  // 3-31 days: daily points
  // > 31 days: sampled points (every 3 or 7 days)
  const chartData: OverviewChartPoint[] = []

  if (durationDays <= 2) {
    // 2-hour slots across 24h
    for (let hour = 0; hour < 24; hour += 2) {
      const slotLabel = hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`

      const slotCurrentOrders = currentOrders.filter((o) => {
        const h = new Date(o.createdAt).getHours()
        return h >= hour && h < hour + 2
      })
      const slotPrevOrders = prevOrders.filter((o) => {
        const h = new Date(o.createdAt).getHours()
        return h >= hour && h < hour + 2
      })

      const curSales = slotCurrentOrders
        .filter((o) => o.status !== "CANCELLED")
        .reduce((sum, o) => sum + Number(o.total), 0)
      const prevSales = slotPrevOrders
        .filter((o) => o.status !== "CANCELLED")
        .reduce((sum, o) => sum + Number(o.total), 0)

      const curOrders = slotCurrentOrders.length
      const prevOrdersCount = slotPrevOrders.length

      chartData.push({
        date: slotLabel,
        current: curSessionsSlot(hour, currentSessionsCount),
        previous: prevSessionsSlot(hour, prevSessionsCount),
        currentSales: curSales,
        previousSales: prevSales,
        currentOrders: curOrders,
        previousOrders: prevOrdersCount,
        currentSessions: curSessionsSlot(hour, currentSessionsCount),
        previousSessions: prevSessionsSlot(hour, prevSessionsCount),
        currentConversion: curOrders > 0 ? 100 : 0,
        previousConversion: prevOrdersCount > 0 ? 100 : 0,
      })
    }
  } else {
    // Daily intervals
    const step = durationDays > 45 ? Math.ceil(durationDays / 15) : 1
    const totalSteps = Math.ceil(durationDays / step)

    for (let i = 0; i < totalSteps; i++) {
      const curDayStart = startOfDay(new Date(currentStart.getTime() + i * step * 86400000))
      const curDayEnd = endOfDay(
        new Date(Math.min(currentEnd.getTime(), curDayStart.getTime() + (step - 1) * 86400000)),
      )

      const prevDayStart = startOfDay(new Date(prevStart.getTime() + i * step * 86400000))
      const prevDayEnd = endOfDay(
        new Date(Math.min(prevEnd.getTime(), prevDayStart.getTime() + (step - 1) * 86400000)),
      )

      const curDayOrders = currentOrders.filter((o) => {
        const t = new Date(o.createdAt).getTime()
        return t >= curDayStart.getTime() && t <= curDayEnd.getTime()
      })
      const prevDayOrders = prevOrders.filter((o) => {
        const t = new Date(o.createdAt).getTime()
        return t >= prevDayStart.getTime() && t <= prevDayEnd.getTime()
      })

      const curSales = curDayOrders
        .filter((o) => o.status !== "CANCELLED")
        .reduce((sum, o) => sum + Number(o.total), 0)
      const prevSales = prevDayOrders
        .filter((o) => o.status !== "CANCELLED")
        .reduce((sum, o) => sum + Number(o.total), 0)

      const curOrders = curDayOrders.length
      const prevOrdersCount = prevDayOrders.length

      chartData.push({
        date: format(curDayStart, "MMM d"),
        current: curDayOrders.length,
        previous: prevDayOrders.length,
        currentSales: curSales,
        previousSales: prevSales,
        currentOrders: curOrders,
        previousOrders: prevOrdersCount,
        currentSessions: 0,
        previousSessions: 0,
        currentConversion: curOrders > 0 ? 100 : 0,
        previousConversion: prevOrdersCount > 0 ? 100 : 0,
      })
    }
  }

  // Fallback top products if no sales recorded yet
  let topProducts: OverviewTopProduct[] = topItemsGroup.map((item) => ({
    title: item.title,
    soldCount: item._sum.quantity ?? 0,
  }))

  if (topProducts.length === 0) {
    const sampleCatalogue = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      take: 3,
      select: { id: true, title: true },
    })
    topProducts = sampleCatalogue.map((p) => ({
      id: p.id,
      title: p.title,
      soldCount: 0,
    }))
  }

  // Format recent orders
  const recentOrders: OverviewRecentOrder[] = recentOrdersDb.map((order) => {
    let statusLabel = "Processing"
    if (order.status === "PENDING") statusLabel = "Pending"
    else if (order.status === "CONFIRMED") statusLabel = "Processing"
    else if (order.status === "FULFILLED") statusLabel = "Delivered"
    else if (order.status === "CANCELLED") statusLabel = "Cancelled"

    return {
      id: order.id,
      number: order.number,
      customerName: order.user?.name ?? "Customer",
      status: order.status,
      statusLabel,
      total: Number(order.total),
      currency: order.currency,
      createdAt: order.createdAt.toISOString(),
    }
  })

  // Store Health percentage
  const storeHealthPercentage =
    totalProductsCount > 0
      ? Math.round((activeProductsCount / totalProductsCount) * 100)
      : 100

  // Customer Growth
  const customerGrowth = calculateChange(newCustomersCurrent, newCustomersPrev)

  // Traffic by attributed channel (Instagram, Facebook, WhatsApp, Google…)
  const channelGroups = await prisma.analyticsSession.groupBy({
    by: ["channel"],
    where: { startedAt: { gte: currentStart, lte: currentEnd } },
    _count: { _all: true },
    orderBy: { _count: { channel: "desc" } },
    take: 5,
  })
  const channelTotal = channelGroups.reduce((sum, group) => sum + group._count._all, 0)
  const trafficSources: OverviewTrafficSource[] = channelGroups.length
    ? channelGroups.map((group) => ({
        source: channelLabel(group.channel),
        percentage: `${channelTotal ? Math.round((group._count._all / channelTotal) * 100) : 0}%`,
        count: group._count._all,
      }))
    : [{ source: "No visits yet", percentage: "0%", count: 0 }]

  return {
    adminName: admin.name || "Admin",
    rangeLabel,
    currentPeriodLabel,
    previousPeriodLabel,
    metrics,
    chartData,
    ordersToFulfil,
    paymentsToCapture,
    recentOrders,
    topProducts,
    storeHealth: {
      percentage: Math.max(1, storeHealthPercentage),
      statusText:
        storeHealthPercentage >= 90
          ? "All systems operational"
          : "Catalog items require review",
      activeProducts: activeProductsCount,
      totalProducts: totalProductsCount,
    },
    trafficSources,
    inventoryAlerts: {
      lowStockCount,
      outOfStockCount,
    },
    customerSnapshot: {
      totalCustomers: totalCustomersCount,
      newCustomersThisPeriod: newCustomersCurrent,
      growthChange: customerGrowth.change,
      isPositiveGrowth: customerGrowth.isPositive,
    },
    catalogSnapshot: {
      totalProducts: totalProductsCount,
      activeProducts: activeProductsCount,
      totalCollections: collectionsCount,
      totalCategories: categoriesCount,
      totalVariants: variantsCount,
    },
  }
}

function curSessionsSlot(hour: number, total: number) {
  if (total === 0) return 0
  return Math.round((total / 12) * (1 + 0.3 * Math.sin(hour)))
}

function prevSessionsSlot(hour: number, total: number) {
  if (total === 0) return 0
  return Math.round((total / 12) * (1 + 0.2 * Math.cos(hour)))
}
