"use server"

import { getCurrentUser } from "@/lib/server/dal/auth"
import { syncUserCart } from "@/lib/server/services/cart"
import { cartSyncSchema } from "@/lib/validations/checkout"

/**
 * Mirrors the browser cart for signed-in shoppers so abandoned checkouts show
 * up in the dashboard. Guests are ignored; nothing here ever throws to the UI.
 */
export async function syncCartAction(input: unknown) {
  const result = cartSyncSchema.safeParse(input)
  if (!result.success) {
    return { success: false as const, synced: false }
  }

  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: true as const, synced: false }
    }

    await syncUserCart(user.id, result.data)
    return { success: true as const, synced: true }
  } catch (error) {
    console.error("[cart] sync failed", error)
    return { success: false as const, synced: false }
  }
}
