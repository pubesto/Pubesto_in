"use server"

import { permissionErrorMessage } from "@/lib/server/dal/auth"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import {
  createCustomer,
  deleteCustomers,
  importCustomers,
  updateCustomer,
} from "@/lib/server/services/customers"
import {
  customerImportSchema,
  customerInputSchema,
} from "@/lib/validations/customer"

type CustomerActionResult =
  | { success: true; customerId: string }
  | { success: false; message: string }

function revalidateCustomerPaths(customerId?: string) {
  revalidatePath("/dashboard/customers")

  if (customerId) {
    revalidatePath(`/dashboard/customers/${customerId}`)
  }
}

function mutationError(error: unknown) {
  const denied = permissionErrorMessage(error)
  if (denied) return denied
  if (error instanceof Error) {
    if (error.message === "Unauthorized") return "Sign in to continue."
    if (error.message === "Forbidden") return "Administrator access is required."
    if (error.message === "SuperAdminRequired") return "Only a full administrator can do this."
    if (
      error.message === "Customer not found." ||
      error.message.includes("already exists")
    ) {
      return error.message
    }
  }

  return "The customer could not be saved. Try again."
}

export async function createCustomerAction(input: unknown): Promise<CustomerActionResult> {
  const result = customerInputSchema.safeParse(input)
  if (!result.success) {
    return {
      success: false,
      message: z.flattenError(result.error).formErrors[0] ?? "Check the customer details.",
    }
  }

  try {
    const customer = await createCustomer(result.data)
    revalidateCustomerPaths(customer.id)
    return { success: true, customerId: customer.id }
  } catch (error) {
    return { success: false, message: mutationError(error) }
  }
}

export async function updateCustomerAction(
  customerId: unknown,
  input: unknown,
): Promise<CustomerActionResult> {
  const id = z.string().trim().min(1).safeParse(customerId)
  const result = customerInputSchema.safeParse(input)
  if (!id.success || !result.success) {
    return { success: false, message: "Check the customer details." }
  }

  try {
    const customer = await updateCustomer(id.data, result.data)
    revalidateCustomerPaths(customer.id)
    return { success: true, customerId: customer.id }
  } catch (error) {
    return { success: false, message: mutationError(error) }
  }
}

export async function deleteCustomersAction(customerIds: unknown) {
  const ids = z.array(z.string().trim().min(1)).min(1).max(100).safeParse(customerIds)
  if (!ids.success) {
    return { success: false, message: "Select at least one customer." }
  }

  try {
    const deleted = await deleteCustomers([...new Set(ids.data)])
    revalidateCustomerPaths()
    return { success: true, count: deleted.count }
  } catch (error) {
    return { success: false, message: mutationError(error) }
  }
}

export async function importCustomersAction(input: unknown) {
  const result = customerImportSchema.safeParse(input)
  if (!result.success) {
    return {
      success: false,
      message: z.flattenError(result.error).formErrors[0] ?? "Check the customer CSV values.",
    }
  }

  try {
    const created = await importCustomers(result.data)
    revalidateCustomerPaths()
    return { success: true, count: created.count }
  } catch (error) {
    return { success: false, message: mutationError(error) }
  }
}
