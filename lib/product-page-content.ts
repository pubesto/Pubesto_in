import { z } from "zod"

/**
 * Per-product storefront content that has no column of its own (stored in
 * `products.pageContent`). Every field defaults to empty, so products saved
 * before a field existed still parse. Images are object keys picked from the
 * product's own Media, so no separate upload flow is needed.
 */
export const PRODUCT_HIGHLIGHT_COUNT = 3
export const PRODUCT_STRIP_COUNT = 4
export const COMPLETE_LOOK_MAX = 3

/* ───────────── Fixed option lists (shared by admin + storefront) ───────────── */

export const EDIT_OPTIONS = ["Originals", "Timeless", "City"] as const
export const GENDER_OPTIONS = [
  { value: "MEN", label: "Men" },
  { value: "WOMEN", label: "Women" },
] as const
export const BADGE_OPTIONS = ["NEW ARRIVAL", "BESTSELLER", "LIMITED", "SALE"] as const

export type SpecKey =
  | "fit" | "rise" | "leg" | "fabric" | "composition" | "stretch" | "construction" | "closure"
  | "hardware" | "backPockets" | "backDetail" | "waistbandDetail" | "wash" | "handFeel" | "countryOfOrigin"

/** Specs in the order they appear in the FEATURES list. `options` = dropdown. */
export const SPEC_FIELDS: { key: SpecKey; label: string; options?: readonly string[]; placeholder?: string }[] = [
  { key: "fit", label: "Fit", options: ["Straight Fit", "Bootcut Fit", "Regular Fit", "Relaxed Fit", "Slim Fit", "Baggy Fit"] },
  { key: "rise", label: "Rise", options: ["Low", "Mid", "High"] },
  { key: "leg", label: "Leg", options: ["Straight", "Bootcut", "Tapered", "Wide", "Skinny", "Flared"] },
  { key: "fabric", label: "Fabric", placeholder: "100% Cotton Denim" },
  { key: "composition", label: "Composition", placeholder: "100% Cotton" },
  { key: "stretch", label: "Stretch", options: ["Yes", "No"] },
  { key: "construction", label: "Construction", placeholder: "Five-Pocket" },
  { key: "closure", label: "Closure", placeholder: "Metal Button + Zip Fly" },
  { key: "hardware", label: "Hardware", placeholder: "Nickel Grey Button" },
  { key: "backPockets", label: "Back Pockets", placeholder: "Patch pockets" },
  { key: "backDetail", label: "Back Detail", placeholder: "Leather patch" },
  { key: "waistbandDetail", label: "Waistband Detail", placeholder: "Embroidery" },
  { key: "wash", label: "Wash", placeholder: "Grey China DX" },
  { key: "handFeel", label: "Hand Feel", placeholder: "Soft" },
  { key: "countryOfOrigin", label: "Country of Origin", placeholder: "India" },
]

export const CARE_OPTIONS = [
  "Machine wash cold",
  "Wash inside out",
  "Wash with similar colours",
  "Do not bleach",
  "Do not tumble dry",
  "Dry in shade",
  "Hang dry",
  "Iron on reverse, medium heat",
  "Do not dry clean",
] as const

export const IMAGE_ROLES = [
  { value: "gallery", label: "Gallery" },
  { value: "detail", label: "Detail close-up" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "hover", label: "Card hover" },
] as const
export type ImageRole = (typeof IMAGE_ROLES)[number]["value"]

/** Size charts available in the "Discover your Size" popup. */
export const SIZE_CHART_OPTIONS = [
  { value: "regular", label: "Regular fit denim" },
  { value: "straight", label: "Straight fit denim" },
  { value: "bootcut", label: "Bootcut fit denim" },
] as const

/* ───────────────────────────────── Schema ───────────────────────────────── */

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().max(max).optional().default(""),
  )

export const productHighlightSchema = z.object({
  imageKey: optionalText(512),
  title: optionalText(80),
  text: optionalText(400),
})

const stripTileSchema = z.object({
  title: optionalText(40),
  text: optionalText(80),
})

const specsSchema = z
  .object(Object.fromEntries(SPEC_FIELDS.map((f) => [f.key, optionalText(120)])) as Record<SpecKey, ReturnType<typeof optionalText>>)
  .partial()
  .default({})

export const productPageContentSchema = z.object({
  /* Identity */
  /** Small grey name above the headline (Figma: "FADED YEARS"). */
  shortName: optionalText(80),
  /** Edit / line: Originals, Timeless, City. */
  edit: optionalText(60),
  articleCode: optionalText(60),
  gender: z.enum(["", "MEN", "WOMEN"]).optional().default(""),
  /** "Colour: Grey Cirrus". */
  colourName: optionalText(60),
  /** One line under the title (Figma: "A classic bootcut silhouette…"). */
  subtitle: optionalText(240),

  /* Specs + highlight strip */
  specs: specsSchema,
  highlightStrip: z.array(stripTileSchema).max(PRODUCT_STRIP_COUNT).default([]),
  hideHighlightStrip: z.boolean().optional().default(false),

  /* Fit & Care */
  fitHeadline: optionalText(120),
  fitText: optionalText(1000),
  care: z.array(z.string().max(80)).max(20).default([]),

  /* Model & size */
  /** Legacy free-text model line; still shown when the fields below are empty. */
  modelInfo: optionalText(160),
  modelHeight: optionalText(20),
  modelSize: optionalText(20),
  modelMeasurements: optionalText(120),
  /** e.g. We recommend sizing down for a closer fit. */
  fitNote: optionalText(240),
  sizeChart: z.enum(["", "regular", "straight", "bootcut"]).optional().default(""),

  /* Offers, badges, social proof */
  /** Discount codes to show as coupon cards. Empty = every active order-wide code. */
  offerCodes: z.array(z.string().max(60)).max(5).default([]),
  bundleLine: optionalText(120),
  hideReturnBadges: z.boolean().optional().default(false),
  showSoldCount: z.boolean().optional().default(false),

  /* Related products (product ids) */
  completeLookIds: z.array(z.string().max(40)).max(COMPLETE_LOOK_MAX).default([]),
  alsoLikeIds: z.array(z.string().max(40)).max(12).default([]),

  /* Card */
  /** Badge on product cards; empty = derived from tags. */
  badge: optionalText(30),
  hoverImageKey: optionalText(512),

  /* Media */
  imageRoles: z.record(z.string().max(512), z.enum(["gallery", "detail", "lifestyle", "hover"])).default({}),

  /* "It's in the Details" + lifestyle */
  highlightsIntro: optionalText(300),
  highlights: z.array(productHighlightSchema).max(PRODUCT_HIGHLIGHT_COUNT).default([]),
  /** Full-width image below "You May Also Like". */
  lifestyleImageKey: optionalText(512),

  /* Shared text overrides (empty = use Website content → Product page) */
  shippingOverride: optionalText(3000),
  originOverride: optionalText(3000),

  /* SEO */
  seoTitle: optionalText(70),
  seoDescription: optionalText(320),

  /* Pubesto storefront (product page + cards) */
  /** One line under the product title, e.g. "Fast & Efficient Cooling". */
  detailLine: optionalText(160),
  /** "Key highlights" bullet list. */
  bulletHighlights: z.array(z.string().max(200)).max(15).default([]),
  /** Shown until real reviews exist, e.g. "4.8" and "45". */
  rating: optionalText(4),
  reviewCount: optionalText(10),
  /** Color name -> hex for the storefront swatches (set from the variant editor). */
  colorSwatches: z.record(z.string().max(60), z.string().max(9)).default({}),
  /** Color name -> image object key shown when that color is picked. */
  colorImages: z.record(z.string().max(60), z.string().max(512)).default({}),
  /** Optional product video (MP4 URL or /videos/... path). */
  videoUrl: optionalText(500),

  /* Set by scripts/import-shopify.ts so re-running the import matches records. */
  shopifyId: optionalText(80),
  shopifyImportedAt: optionalText(40),
  shopifyVariantIds: z.record(z.string().max(80), z.string().max(40)).default({}),
})

export type ProductHighlight = z.infer<typeof productHighlightSchema>
export type ProductPageContent = z.infer<typeof productPageContentSchema>

export const emptyProductPageContent: ProductPageContent = productPageContentSchema.parse({})

/** Reads the stored JSON leniently; anything malformed falls back to empty. */
export function parseProductPageContent(value: unknown): ProductPageContent {
  const result = productPageContentSchema.safeParse(value ?? {})
  return result.success ? result.data : emptyProductPageContent
}

/** "Model is 5'9" wearing a size 32" from the separate fields (or the legacy line). */
export function modelLine(content: Pick<ProductPageContent, "modelInfo" | "modelHeight" | "modelSize" | "modelMeasurements">) {
  if (!content.modelHeight && !content.modelSize) return content.modelInfo
  const parts = [
    content.modelHeight ? `Model is ${content.modelHeight}` : "Model",
    content.modelSize ? `wearing a size ${content.modelSize}` : "",
  ].filter(Boolean)
  const line = parts.join(" ")
  return content.modelMeasurements ? `${line} · ${content.modelMeasurements}` : line
}
