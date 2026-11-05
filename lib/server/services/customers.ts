import "server-only"

import { assertPermission } from "@/lib/server/dal/auth"
import { getPrisma } from "@/lib/server/db"
import type {
  CustomerImport,
  CustomerInput,
} from "@/lib/validations/customer"

async function ensureEmailIsAvailable(
  email: string,
  excludingCustomerId?: string,
) {
  const prisma = getPrisma()
  const matchingUser = await prisma.user.findFirst({
    where: {
      email,
      ...(excludingCustomerId ? { id: { not: excludingCustomerId } } : {}),
    },
    select: { id: true },
  })

  if (matchingUser) {
    throw new Error("A user with this email address already exists.")
  }
}

export async function createCustomer(input: CustomerInput) {
  await assertPermission("customers.manage")
  await ensureEmailIsAvailable(input.email)

  return getPrisma().user.create({
    data: {
      name: input.name,
      email: input.email,
      emailMarketingSubscribed: input.emailMarketingSubscribed,
      role: "CUSTOMER",
    },
    select: { id: true },
  })
}

export async function updateCustomer(customerId: string, input: CustomerInput) {
  await assertPermission("customers.manage")
  const prisma = getPrisma()
  const customer = await prisma.user.findFirst({
    where: { id: customerId, role: "CUSTOMER" },
    select: { id: true, email: true },
  })

  if (!customer) {
    throw new Error("Customer not found.")
  }

  if (customer.email !== input.email) {
    await ensureEmailIsAvailable(input.email, customerId)
  }

  return prisma.user.update({
    where: { id: customerId },
    data: {
      name: input.name,
      email: input.email,
      emailMarketingSubscribed: input.emailMarketingSubscribed,
    },
    select: { id: true },
  })
}

export async function deleteCustomers(customerIds: string[]) {
  await assertPermission("customers.delete")
  return getPrisma().user.deleteMany({
    where: { id: { in: customerIds }, role: "CUSTOMER" },
  })
}

export async function importCustomers(customers: CustomerImport) {
  await assertPermission("customers.manage")
  const prisma = getPrisma()
  const emails = customers.map((customer) => customer.email)
  const existing = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { email: true },
  })

  if (existing.length) {
    throw new Error(`A user with ${existing[0].email} already exists.`)
  }

  return prisma.user.createMany({
    data: customers.map((customer) => ({
      name: customer.name,
      email: customer.email,
      emailMarketingSubscribed: customer.emailMarketingSubscribed,
      role: "CUSTOMER",
    })),
  })
}
