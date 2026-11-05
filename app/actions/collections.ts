"use server"

import { permissionErrorMessage } from "@/lib/server/dal/auth"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import {
  createCollection,
  deleteCollections,
  updateCollection,
  updateCollectionPublished,
} from "@/lib/server/services/collections"
import { collectionInputSchema } from "@/lib/validations/collection"

export type CollectionActionState =
  | { status: "success"; collectionId: string }
  | {
      status: "error"
      message: string
      fields?: Record<string, string[] | undefined>
    }

function revalidateCollectionPaths(collectionId?: string) {
  revalidatePath("/")
  revalidatePath("/collections")
  revalidatePath("/collections/[slug]", "page")
  revalidatePath("/dashboard/products")
  revalidatePath("/dashboard/products/collections")
  revalidatePath("/dashboard/products/collections/new")

  if (collectionId) {
    revalidatePath(`/dashboard/products/collections/${collectionId}`)
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
      error.message === "Collection not found." ||
      error.message.includes("no longer exist")
    ) {
      return error.message
    }
  }

  return "The collection could not be saved. Try again."
}

export async function createCollectionAction(
  input: unknown,
): Promise<CollectionActionState> {
  const result = collectionInputSchema.safeParse(input)
  if (!result.success) {
    return {
      status: "error",
      message: "Check the highlighted collection fields.",
      fields: z.flattenError(result.error).fieldErrors,
    }
  }

  try {
    const collection = await createCollection(result.data)
    revalidateCollectionPaths(collection.id)
    return { status: "success", collectionId: collection.id }
  } catch (error) {
    return { status: "error", message: mutationError(error) }
  }
}

export async function updateCollectionAction(
  collectionId: string,
  input: unknown,
): Promise<CollectionActionState> {
  const id = z.string().trim().min(1).safeParse(collectionId)
  const result = collectionInputSchema.safeParse(input)
  if (!id.success || !result.success) {
    return {
      status: "error",
      message: "Check the highlighted collection fields.",
      fields: result.success ? undefined : z.flattenError(result.error).fieldErrors,
    }
  }

  try {
    const collection = await updateCollection(id.data, result.data)
    revalidateCollectionPaths(collection.id)
    return { status: "success", collectionId: collection.id }
  } catch (error) {
    return { status: "error", message: mutationError(error) }
  }
}

export async function updateCollectionPublishedAction(
  collectionId: string,
  isPublished: boolean,
) {
  const id = z.string().trim().min(1).safeParse(collectionId)
  if (!id.success) {
    return { success: false, message: "Invalid collection." }
  }

  try {
    await updateCollectionPublished(id.data, z.boolean().parse(isPublished))
    revalidateCollectionPaths(id.data)
    return { success: true }
  } catch (error) {
    return { success: false, message: mutationError(error) }
  }
}

export async function deleteCollectionsAction(collectionIds: unknown) {
  const ids = z.array(z.string().trim().min(1)).min(1).max(100).safeParse(collectionIds)
  if (!ids.success) {
    return { success: false, message: "Select at least one collection." }
  }

  try {
    const deleted = await deleteCollections([...new Set(ids.data)])
    revalidateCollectionPaths()
    return { success: true, count: deleted.count }
  } catch (error) {
    return { success: false, message: mutationError(error) }
  }
}
