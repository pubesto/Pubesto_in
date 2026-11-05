"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { assertPermission, permissionErrorMessage } from "@/lib/server/dal/auth"
import {
  createCategory,
  deleteCategories,
  updateCategory,
  updateCategoryVisibility,
} from "@/lib/server/services/categories"
import { categoryInputSchema } from "@/lib/validations/category"

export type CategoryActionState =
  | { status: "success"; categoryId: string }
  | {
      status: "error"
      message: string
      fields?: Record<string, string[] | undefined>
    }

function revalidateCategoryPaths(categoryId?: string) {
  revalidatePath("/dashboard/products/categories")
  revalidatePath("/dashboard/products")
  revalidatePath("/dashboard/products/categories/new")

  if (categoryId) {
    revalidatePath(`/dashboard/products/categories/${categoryId}`)
  }
}

function mutationError(error: unknown) {
  const denied = permissionErrorMessage(error)
  if (denied) return denied
  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return "Sign in to continue."
    }
    if (error.message === "Forbidden" || error.message === "SuperAdminRequired" || error.message.startsWith("PermissionDenied:")) {
      return "Administrator access is required."
    }
    if (
      error.message === "Category not found." ||
      error.message.includes("no longer exist") ||
      error.message.includes("cannot be its own")
    ) {
      return error.message
    }
  }

  return "The category could not be saved. Try again."
}

export async function createCategoryAction(
  input: unknown,
): Promise<CategoryActionState> {
  const result = categoryInputSchema.safeParse(input)

  if (!result.success) {
    return {
      status: "error",
      message: "Check the highlighted category fields.",
      fields: z.flattenError(result.error).fieldErrors,
    }
  }

  try {
    await assertPermission("categories.manage")
    const category = await createCategory(result.data)
    revalidateCategoryPaths(category.id)

    return { status: "success", categoryId: category.id }
  } catch (error) {
    return { status: "error", message: mutationError(error) }
  }
}

export async function updateCategoryAction(
  categoryId: string,
  input: unknown,
): Promise<CategoryActionState> {
  const id = z.string().trim().min(1).safeParse(categoryId)
  const result = categoryInputSchema.safeParse(input)

  if (!id.success || !result.success) {
    return {
      status: "error",
      message: "Check the highlighted category fields.",
      fields: result.success
        ? undefined
        : z.flattenError(result.error).fieldErrors,
    }
  }

  try {
    await assertPermission("categories.manage")
    const category = await updateCategory(id.data, result.data)
    revalidateCategoryPaths(category.id)

    return { status: "success", categoryId: category.id }
  } catch (error) {
    return { status: "error", message: mutationError(error) }
  }
}

export async function updateCategoryVisibilityAction(
  categoryId: string,
  visible: boolean,
) {
  const id = z.string().trim().min(1).safeParse(categoryId)

  if (!id.success) {
    return { success: false, message: "Invalid category." }
  }

  try {
    await assertPermission("categories.manage")
    await updateCategoryVisibility(id.data, z.boolean().parse(visible))
    revalidateCategoryPaths(id.data)
    return { success: true }
  } catch (error) {
    return { success: false, message: mutationError(error) }
  }
}

export async function deleteCategoriesAction(categoryIds: unknown) {
  const ids = z.array(z.string().trim().min(1)).min(1).max(100).safeParse(categoryIds)

  if (!ids.success) {
    return { success: false, message: "Select at least one category." }
  }

  try {
    await assertPermission("categories.manage")
    const deleted = await deleteCategories([...new Set(ids.data)])
    revalidateCategoryPaths()
    return { success: true, count: deleted.count }
  } catch (error) {
    return { success: false, message: mutationError(error) }
  }
}
