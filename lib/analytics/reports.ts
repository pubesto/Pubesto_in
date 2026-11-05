/**
 * Report catalogue for Dashboard → Analytics → Reports. Shared between the
 * list page and the server so slugs stay in one place.
 */

export type ReportCategory = "Acquisition" | "Behavior" | "Sales" | "Search"

export type ReportDefinition = {
  slug: string
  name: string
  category: ReportCategory
  description: string
}

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  { slug: "sessions-over-time", name: "Sessions over time", category: "Acquisition", description: "Visits per day, compared with the previous period." },
  { slug: "visitors-over-time", name: "Visitors over time", category: "Acquisition", description: "Unique visitors per day." },
  { slug: "sessions-by-channel", name: "Sessions by traffic source", category: "Acquisition", description: "Where visitors came from: Instagram, Facebook, WhatsApp, Google and more." },
  { slug: "sessions-by-referrer", name: "Sessions by referrer", category: "Acquisition", description: "Referring websites and apps." },
  { slug: "sessions-by-campaign", name: "Sessions by campaign", category: "Acquisition", description: "UTM campaigns and their conversions." },
  { slug: "sessions-by-location", name: "Sessions by location", category: "Acquisition", description: "Countries visitors browse from." },
  { slug: "new-vs-returning", name: "New vs returning visitors", category: "Acquisition", description: "First-time versus repeat visitors." },
  { slug: "sessions-by-device", name: "Sessions by device type", category: "Behavior", description: "Desktop, mobile and tablet share." },
  { slug: "sessions-by-landing-page", name: "Sessions by landing page", category: "Behavior", description: "First page of each visit." },
  { slug: "pages-by-views", name: "Pages by views", category: "Behavior", description: "Most viewed pages." },
  { slug: "bounce-rate-over-time", name: "Bounce rate over time", category: "Behavior", description: "Share of single-page visits per day." },
  { slug: "conversion-rate-over-time", name: "Conversion rate over time", category: "Behavior", description: "Orders divided by sessions, per day." },
  { slug: "checkout-funnel", name: "Checkout conversion funnel", category: "Behavior", description: "Sessions → product views → add to cart → checkout → purchase." },
  { slug: "products-by-views", name: "Products by views", category: "Behavior", description: "Most viewed products and how often they were added to the bag." },
  { slug: "total-sales-over-time", name: "Total sales over time", category: "Sales", description: "Storefront revenue per day." },
  { slug: "orders-over-time", name: "Orders over time", category: "Sales", description: "Orders per day." },
  { slug: "average-order-value", name: "Average order value over time", category: "Sales", description: "Revenue per order, per day." },
  { slug: "sales-by-channel", name: "Sales by traffic source", category: "Sales", description: "Revenue attributed to the channel that brought the visitor." },
  { slug: "sales-by-product", name: "Sales by product", category: "Sales", description: "Units and revenue per product." },
  { slug: "searches-by-query", name: "Searches by search query", category: "Search", description: "What shoppers type into search." },
  { slug: "searches-with-no-results", name: "Searches with no results", category: "Search", description: "Queries that returned nothing: catalogue gaps." },
  { slug: "searches-over-time", name: "Searches over time", category: "Search", description: "Search volume per day." },
]

export function findReport(slug: string) {
  return REPORT_DEFINITIONS.find((report) => report.slug === slug) ?? null
}

export type ReportColumn = {
  key: string
  label: string
  format?: "number" | "currency" | "percent" | "text" | "duration"
  align?: "left" | "right"
}

export type ReportChart = {
  type: "line" | "bar"
  xKey: string
  series: Array<{ key: string; label: string; color?: string; format?: ReportColumn["format"] }>
}

export type ReportResult = {
  slug: string
  name: string
  category: ReportCategory
  description: string
  rangeLabel: string
  summary: Array<{ label: string; value: string }>
  columns: ReportColumn[]
  rows: Array<Record<string, string | number | null>>
  chart: ReportChart | null
}
