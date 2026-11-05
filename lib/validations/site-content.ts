import { z } from "zod"

import { contactGroupsFromLegacy, isValidContactLine } from "@/lib/contact-lines"
import { PAGE_KEYS, storedPageContentSchema } from "@/lib/page-content"
import { DEFAULT_SITE_CONTENT } from "@/lib/site-content"

const shortText = z.string().trim().max(200)
const mediumText = z.string().trim().max(1000)
const longText = z.string().trim().max(10000)
const imagePath = z
  .string()
  .trim()
  .min(1, "Choose an image.")
  .max(1024)
  .refine((value) => value.startsWith("/") || /^https?:\/\//.test(value), "Enter an image path or URL.")

const policyBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: longText }),
  z.object({ type: z.literal("list"), items: z.array(mediumText).max(50) }),
])

const policySectionSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Section ids use lowercase letters, numbers and dashes."),
  title: shortText.min(1, "Enter a section title."),
  navLabel: shortText,
  blocks: z.array(policyBlockSchema).max(100),
  subsections: z
    .array(z.object({ title: shortText.min(1), blocks: z.array(policyBlockSchema).max(50) }))
    .max(20),
})

export const policyContentSchema = z.object({
  title: shortText.min(1),
  metaTitle: shortText,
  metaDescription: mediumText,
  intro: z.array(longText).max(10),
  sections: z.array(policySectionSchema).min(1, "Add at least one section.").max(40),
})

const navHref = z.string().trim().min(1, "Enter a link.").max(500)
const navMenuLinkSchema = z.object({ label: shortText.min(1, "Enter a label."), href: navHref })

export const siteContentSchemas = {
  // Pages built from lib/page-content.ts (login, cart, checkout…).
  ...(Object.fromEntries(PAGE_KEYS.map((key) => [key, storedPageContentSchema])) as Record<
    (typeof PAGE_KEYS)[number],
    typeof storedPageContentSchema
  >),
  announcements: z.object({
    left: shortText,
    center: shortText,
    right: shortText,
    mobile: z.array(shortText.min(1)).min(1, "Add at least one mobile message.").max(10),
  }),
  // Every field has a default so navigation rows saved by older versions of
  // the admin (which had a single `collections` list and at most 2 images)
  // still parse instead of silently falling back to the code defaults.
  navigation: z.preprocess(
    (raw) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw
      const value = { ...(raw as Record<string, unknown>) }
      // Legacy: the old "Collections" list becomes the Men menu "Collection" column.
      if (value.menCollections === undefined && Array.isArray(value.collections)) {
        value.menCollections = value.collections
      }
      delete value.collections
      // Legacy default pointed at a homepage anchor; the Shop All page replaces it.
      if (value.bestsellersHref === "/#bestsellers") {
        value.bestsellersHref = DEFAULT_SITE_CONTENT.navigation.bestsellersHref
      }
      return value
    },
    z.object({
      edits: z.array(navMenuLinkSchema).max(12).default(() => structuredClone(DEFAULT_SITE_CONTENT.navigation.edits)),
      menCollections: z
        .array(navMenuLinkSchema)
        .max(12)
        .default(() => structuredClone(DEFAULT_SITE_CONTENT.navigation.menCollections)),
      categories: z
        .array(navMenuLinkSchema)
        .max(12)
        .default(() => structuredClone(DEFAULT_SITE_CONTENT.navigation.categories)),
      menFeatured: z
        .array(navMenuLinkSchema)
        .max(12)
        .default(() => structuredClone(DEFAULT_SITE_CONTENT.navigation.menFeatured)),
      cards: z
        .array(
          z.object({
            image: imagePath,
            alt: shortText,
            eyebrow: shortText,
            title: shortText,
            href: navHref,
          }),
        )
        .max(3)
        .default(() => structuredClone(DEFAULT_SITE_CONTENT.navigation.cards)),
      bestsellersHref: navHref.default(DEFAULT_SITE_CONTENT.navigation.bestsellersHref),
      collectionsLabel: shortText.min(1).default(DEFAULT_SITE_CONTENT.navigation.collectionsLabel),
    }),
  ),
  launchOffer: z.object({
    enabled: z.boolean(),
    label: shortText,
    endsAt: z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date and time."),
    ctaText: shortText.min(1),
    ctaHref: z.string().trim().min(1).max(500),
  }),
  lookbook: z.object({
    slides: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(80),
          image: imagePath,
          alt: shortText,
          objectPosition: z.string().trim().max(40).default("center"),
        }),
      )
      .min(1, "Add at least one slide.")
      .max(24),
  }),
  edits: z.object({
    heading: shortText.min(1),
    tabs: z.array(z.object({ label: shortText.min(1), active: z.boolean() })).max(8),
    slides: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(80),
          image: imagePath,
          alt: shortText,
          label: shortText,
          href: z.string().trim().max(500),
        }),
      )
      .min(1, "Add at least one slide.")
      .max(24),
  }),
  contact: z.object({
    eyebrow: shortText,
    titleLines: z.array(shortText).min(1).max(4),
    description: mediumText,
    phone: shortText,
    phoneHours: shortText,
    email: shortText,
    emailResponse: shortText,
    chatLabel: shortText,
    chatHours: shortText,
    faqs: z.array(z.object({ question: mediumText.min(1), answer: longText.min(1) })).max(30),
  }),
  // Older rows stored three fixed fields; they are converted to groups on read.
  footer: z.preprocess(
    (raw) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw
      const value = raw as Record<string, unknown>
      return Array.isArray(value.contactGroups) ? value : { ...value, contactGroups: contactGroupsFromLegacy(value) }
    },
    z.object({
      contactGroups: z
        .array(
          z.object({
            heading: shortText.min(1, "Give each contact group a heading."),
            lines: z
              .array(
                z
                  .object({
                    type: z.enum(["email", "phone", "whatsapp", "text"]),
                    label: shortText,
                    value: shortText.min(1, "Fill in or remove empty contact lines."),
                  })
                  .refine(isValidContactLine, {
                    message: "Check the contact lines: emails need an @, phone and WhatsApp numbers need at least 7 digits.",
                  }),
              )
              .min(1, "Each contact group needs at least one line.")
              .max(10),
          }),
        )
        .max(8),
      columns: z
        .array(
          z.object({
            title: shortText.min(1, "Give each footer column a title."),
            // An empty link hides that item on the site.
            links: z.array(z.object({ label: shortText.min(1, "Enter a label."), href: z.string().trim().max(500) })).max(12),
          }),
        )
        .max(5)
        .default(() => structuredClone(DEFAULT_SITE_CONTENT.footer.columns)),
      newsletterHeading: shortText.default(DEFAULT_SITE_CONTENT.footer.newsletterHeading),
      newsletterPlaceholder: shortText.default(DEFAULT_SITE_CONTENT.footer.newsletterPlaceholder),
      newsletterButton: shortText.min(1).default(DEFAULT_SITE_CONTENT.footer.newsletterButton),
      copyright: shortText.default(DEFAULT_SITE_CONTENT.footer.copyright),
      legalLinks: z.array(navMenuLinkSchema).max(6).default(() => structuredClone(DEFAULT_SITE_CONTENT.footer.legalLinks)),
    }),
  ),
  productPage: z.object({
    showHighlightStrip: z.boolean().default(true),
    returnsBadge: shortText,
    exchangesBadge: shortText,
    shipping: longText,
    returns: longText,
    exchanges: longText,
    refunds: longText,
    origin: longText,
  }),
  returnsPage: z.object({
    title: shortText.min(1),
    image: imagePath,
    conditions: z.array(mediumText.min(1)).max(20),
  }),
  // Rows saved before the Figma redesign carry `images` (tech-pack pages) and the
  // old "Size Guide" heading; drop the images and move them to the new title.
  sizeGuide: z.preprocess(
    (value) => {
      if (!value || typeof value !== "object" || !("images" in value)) return value
      const { images: _images, ...rest } = value as Record<string, unknown>
      void _images
      return rest.title === "Size Guide"
        ? { ...rest, title: DEFAULT_SITE_CONTENT.sizeGuide.title, subtitle: "" }
        : rest
    },
    z.object({
      title: shortText.min(1),
      subtitle: shortText.default(""),
      note: mediumText.default(DEFAULT_SITE_CONTENT.sizeGuide.note),
    }),
  ),
  privacyPolicy: policyContentSchema,
  termsPolicy: policyContentSchema,
  shippingPolicy: policyContentSchema,
} as const

export type SiteContentSchemas = typeof siteContentSchemas

export const siteContentKeySchema = z.enum([
  "announcements",
  "navigation",
  "launchOffer",
  "lookbook",
  "edits",
  "contact",
  "footer",
  "productPage",
  "returnsPage",
  "sizeGuide",
  "privacyPolicy",
  "termsPolicy",
  "shippingPolicy",
  "loginPage",
  "signupPage",
  "cartPage",
  "checkoutPage",
  "wishlistPage",
  "trackOrderPage",
  "shopPage",
  "collectionsPage",
])
