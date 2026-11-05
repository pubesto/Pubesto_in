import { SPEC_FIELDS, type ProductPageContent } from "@/lib/product-page-content"

/**
 * CSV columns for product import. Headers are matched case- and
 * space-insensitively ("Short name" = "shortname"). Lists use "|".
 */
export const PRODUCT_CSV_COLUMNS = [
  "Title", "Slug", "SKU", "Price", "Compare at price", "Inventory quantity", "Status", "Category", "Collections", "Tags",
  "Description",
  "Short name", "Edit", "Article code", "Gender", "Colour", "Subtitle",
  ...SPEC_FIELDS.map((f) => f.label),
  "Highlight strip",
  "Fit headline", "Fit text", "Care",
  "Model height", "Model size", "Model measurements", "Fit note", "Size chart",
  "Badge", "Bundle line", "Show sold count", "Hide return badges",
  "SEO title", "SEO description",
] as const

const norm = (header: string) => header.trim().toLowerCase().replace(/[^a-z0-9]/g, "")
const list = (value: string | undefined) => (value ?? "").split("|").map((v) => v.trim()).filter(Boolean)
const yes = (value: string | undefined) => /^(y|yes|true|1)$/i.test((value ?? "").trim())

/** Page content fields from one parsed CSV row (keys already normalised). */
export function pageContentFromCsvRow(row: Record<string, string>): Partial<ProductPageContent> {
  const get = (header: string) => row[norm(header)]?.trim() ?? ""
  const gender = get("Gender").toUpperCase()
  const sizeChart = get("Size chart").toLowerCase()
  const specs = Object.fromEntries(
    SPEC_FIELDS.map((f) => [f.key, get(f.label)]).filter(([, v]) => v),
  )
  // "STRAIGHT FIT: Clean line | 100% COTTON: Soft hand"
  const highlightStrip = list(get("Highlight strip")).slice(0, 4).map((tile) => {
    const [title, ...rest] = tile.split(":")
    return { title: title.trim(), text: rest.join(":").trim() }
  })

  return {
    shortName: get("Short name"),
    edit: get("Edit"),
    articleCode: get("Article code"),
    gender: gender === "MEN" || gender === "WOMEN" ? gender : "",
    colourName: get("Colour"),
    subtitle: get("Subtitle"),
    specs,
    highlightStrip,
    fitHeadline: get("Fit headline"),
    fitText: get("Fit text"),
    care: list(get("Care")),
    modelHeight: get("Model height"),
    modelSize: get("Model size"),
    modelMeasurements: get("Model measurements"),
    fitNote: get("Fit note"),
    sizeChart: sizeChart === "regular" || sizeChart === "straight" || sizeChart === "bootcut" ? sizeChart : "",
    badge: get("Badge").toUpperCase(),
    bundleLine: get("Bundle line"),
    showSoldCount: yes(get("Show sold count")),
    hideReturnBadges: yes(get("Hide return badges")),
    seoTitle: get("SEO title"),
    seoDescription: get("SEO description"),
  }
}
