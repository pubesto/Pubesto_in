"use server"

import { redirect } from "next/navigation"

import { trackOrderLookupSchema } from "@/lib/validations/contact"

/**
 * Form action for the public order tracking page. Normalises the lookup and
 * redirects to a shareable URL that the page resolves server-side.
 */
export async function trackOrderAction(formData: FormData) {
  const result = trackOrderLookupSchema.safeParse({
    order: formData.get("order-number"),
    email: formData.get("email"),
    postcode: formData.get("postcode") ?? undefined,
  })

  if (!result.success) {
    redirect("/track-order?status=invalid")
  }

  const params = new URLSearchParams({
    order: result.data.order,
    email: result.data.email,
  })
  if (result.data.postcode) {
    params.set("postcode", result.data.postcode)
  }

  redirect(`/track-order?${params.toString()}`)
}
