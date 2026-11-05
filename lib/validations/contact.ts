import { z } from "zod"

export const contactMessageSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(254),
  subject: z.string().trim().min(1, "Choose a subject.").max(120),
  message: z.string().trim().min(10, "Tell us a little more.").max(4000),
  /** Honeypot: real visitors never fill this. */
  website: z.string().max(0).optional(),
})

export type ContactMessageInput = z.infer<typeof contactMessageSchema>

export const trackOrderLookupSchema = z.object({
  order: z
    .string()
    .trim()
    .transform((value) => value.replace(/[^0-9]/g, ""))
    .pipe(z.string().min(1, "Enter your order number.").max(12)),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  postcode: z.string().trim().max(12).optional(),
})

export type TrackOrderLookup = z.infer<typeof trackOrderLookupSchema>
