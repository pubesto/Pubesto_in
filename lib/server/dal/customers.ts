import "server-only"

import { requirePermission } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"

type AddressRecord = Record<string, unknown>

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function formatLocation(address: unknown) {
  if (!address || typeof address !== "object" || Array.isArray(address)) {
    return "—"
  }

  const record = address as AddressRecord
  const city = stringValue(record.city)
  const region =
    stringValue(record.stateCode) ??
    stringValue(record.provinceCode) ??
    stringValue(record.state) ??
    stringValue(record.province)
  const country = stringValue(record.country) ?? stringValue(record.countryCode)
  const location = [city, region, country].filter(Boolean)

  return location.length ? location.join(", ") : "—"
}

function totals(orders: Array<{ total: { toString(): string }; currency: string }>) {
  return {
    orderCount: orders.length,
    amountSpent: orders.reduce((sum, order) => sum + Number(order.total), 0),
    currency: orders[0]?.currency ?? "INR",
  }
}

export type AdminCustomerListItem = {
  id: string
  name: string
  email: string
  emailMarketingSubscribed: boolean
  location: string
  orderCount: number
  amountSpent: number
  currency: string
  createdAt: string
}

export type AdminCustomerDetail = AdminCustomerListItem & {
  orders: Array<{
    id: string
    number: number
    status: "PENDING" | "CONFIRMED" | "FULFILLED" | "CANCELLED"
    total: number
    currency: string
    createdAt: string
  }>
}

export async function listCustomersForAdmin(): Promise<AdminCustomerListItem[]> {
  await requirePermission("customers.view")
  const prisma = getPrisma()
  const customers = await prisma.user.findMany({
    where: { role: "CUSTOMER" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      emailMarketingSubscribed: true,
      createdAt: true,
      orders: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { createdAt: "desc" },
        select: { total: true, currency: true, shippingAddress: true },
      },
    },
  })

  return customers.map((customer) => {
    const summary = totals(customer.orders)

    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      emailMarketingSubscribed: customer.emailMarketingSubscribed,
      location: formatLocation(customer.orders[0]?.shippingAddress),
      ...summary,
      createdAt: customer.createdAt.toISOString(),
    }
  })
}

export async function getCustomerForAdmin(
  customerId: string,
): Promise<AdminCustomerDetail | null> {
  await requirePermission("customers.view")
  const prisma = getPrisma()
  const customer = await prisma.user.findFirst({
    where: { id: customerId, role: "CUSTOMER" },
    select: {
      id: true,
      name: true,
      email: true,
      emailMarketingSubscribed: true,
      createdAt: true,
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          currency: true,
          createdAt: true,
          shippingAddress: true,
        },
      },
    },
  })

  if (!customer) {
    return null
  }

  const nonCancelledOrders = customer.orders.filter(
    (order) => order.status !== "CANCELLED",
  )
  const summary = totals(nonCancelledOrders)

  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    emailMarketingSubscribed: customer.emailMarketingSubscribed,
    location: formatLocation(customer.orders[0]?.shippingAddress),
    ...summary,
    createdAt: customer.createdAt.toISOString(),
    orders: customer.orders.map((order) => ({
      id: order.id,
      number: order.number,
      status: order.status,
      total: Number(order.total),
      currency: order.currency,
      createdAt: order.createdAt.toISOString(),
    })),
  }
}
