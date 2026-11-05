"use server"

import { redirect } from "next/navigation"
import { after } from "next/server"

import { getPrisma } from "@/lib/server/db"
import { notifyContactMessage } from "@/lib/server/notifications"
import { contactMessageSchema } from "@/lib/validations/contact"

/**
 * Form action for the storefront contact page. Stores the message, emails
 * the team and acknowledges the sender, then redirects back with a flag.
 */
export async function submitContactAction(formData: FormData) {
  const result = contactMessageSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject"),
    message: formData.get("message"),
    website: formData.get("website") ?? undefined,
  })

  if (!result.success) {
    redirect("/contact?status=invalid")
  }

  // Honeypot filled in: silently pretend success.
  if (result.data.website) {
    redirect("/contact?status=sent")
  }

  let messageId: string
  try {
    const created = await getPrisma().contactMessage.create({
      data: {
        name: result.data.name,
        email: result.data.email,
        subject: result.data.subject,
        message: result.data.message,
      },
      select: { id: true },
    })
    messageId = created.id
  } catch (error) {
    console.error("[contact] could not store message", error)
    redirect("/contact?status=error")
  }

  after(() => notifyContactMessage(messageId))

  redirect("/contact?status=sent")
}
