/**
 * Dashboard permission catalogue. ADMIN implicitly holds every permission;
 * SUB_ADMIN users hold exactly the keys stored on `users.permissions`.
 *
 * Keys follow `<module>.<level>`. Holding any key for a module satisfies that
 * module's `.view` check, so "manage" or "delete" never need "view" as well.
 */

export type PermissionLevel = "view" | "manage" | "delete"

export type PermissionDefinition = {
  key: PermissionKey
  label: string
  description: string
}

export type PermissionModule = {
  key: PermissionModuleKey
  label: string
  description: string
  permissions: PermissionDefinition[]
}

export const PERMISSION_MODULE_KEYS = [
  "orders",
  "products",
  "inventory",
  "categories",
  "collections",
  "banners",
  "customers",
  "reviews",
  "returns",
  "messages",
  "discounts",
  "analytics",
  "taxes",
  "content",
] as const

export type PermissionModuleKey = (typeof PERMISSION_MODULE_KEYS)[number]

export type PermissionKey =
  | "orders.view"
  | "orders.manage"
  | "products.view"
  | "products.manage"
  | "products.delete"
  | "inventory.view"
  | "inventory.manage"
  | "categories.view"
  | "categories.manage"
  | "categories.delete"
  | "collections.view"
  | "collections.manage"
  | "collections.delete"
  | "banners.view"
  | "banners.manage"
  | "banners.delete"
  | "customers.view"
  | "customers.manage"
  | "customers.delete"
  | "reviews.view"
  | "reviews.manage"
  | "reviews.delete"
  | "returns.view"
  | "returns.manage"
  | "messages.view"
  | "messages.manage"
  | "discounts.view"
  | "discounts.manage"
  | "discounts.delete"
  | "analytics.view"
  | "taxes.view"
  | "taxes.manage"
  | "content.view"
  | "content.manage"

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    key: "orders",
    label: "Orders",
    description: "Orders, draft orders and abandoned checkouts.",
    permissions: [
      { key: "orders.view", label: "View", description: "See orders, drafts and abandoned checkouts." },
      { key: "orders.manage", label: "Manage", description: "Create orders, mark paid, fulfil, cancel, send drafts, recover checkouts." },
    ],
  },
  {
    key: "products",
    label: "Products",
    description: "The product catalogue, variants and images.",
    permissions: [
      { key: "products.view", label: "View", description: "See products and variants." },
      { key: "products.manage", label: "Manage", description: "Create and edit products, upload images, change status." },
      { key: "products.delete", label: "Delete", description: "Permanently delete products." },
    ],
  },
  {
    key: "inventory",
    label: "Inventory",
    description: "Stock levels per variant.",
    permissions: [
      { key: "inventory.view", label: "View", description: "See stock levels." },
      { key: "inventory.manage", label: "Manage", description: "Adjust and import stock quantities." },
    ],
  },
  {
    key: "categories",
    label: "Categories",
    description: "Category tree and visibility.",
    permissions: [
      { key: "categories.view", label: "View", description: "See categories." },
      { key: "categories.manage", label: "Manage", description: "Create, edit, show or hide categories." },
      { key: "categories.delete", label: "Delete", description: "Delete categories." },
    ],
  },
  {
    key: "collections",
    label: "Collections",
    description: "Curated collections shown on the storefront.",
    permissions: [
      { key: "collections.view", label: "View", description: "See collections." },
      { key: "collections.manage", label: "Manage", description: "Create, edit, publish or unpublish collections." },
      { key: "collections.delete", label: "Delete", description: "Delete collections." },
    ],
  },
  {
    key: "banners",
    label: "Banners & media",
    description: "Homepage banners and the media library.",
    permissions: [
      { key: "banners.view", label: "View", description: "See banners and the media library." },
      { key: "banners.manage", label: "Manage", description: "Create, edit, reorder and toggle banners; upload media." },
      { key: "banners.delete", label: "Delete", description: "Delete banners and stored media files." },
    ],
  },
  {
    key: "customers",
    label: "Customers",
    description: "Customer database and marketing status.",
    permissions: [
      { key: "customers.view", label: "View", description: "See customer profiles and order history." },
      { key: "customers.manage", label: "Manage", description: "Create, edit and import customers." },
      { key: "customers.delete", label: "Delete", description: "Delete customer accounts." },
    ],
  },
  {
    key: "reviews",
    label: "Reviews",
    description: "Customer product reviews and homepage testimonials.",
    permissions: [
      { key: "reviews.view", label: "View", description: "See all reviews, including ones awaiting approval." },
      { key: "reviews.manage", label: "Manage", description: "Approve, publish, edit, feature on the homepage and add reviews." },
      { key: "reviews.delete", label: "Delete", description: "Permanently delete reviews." },
    ],
  },
  {
    key: "returns",
    label: "Returns & cancellations",
    description: "Customer return requests and order cancellation requests.",
    permissions: [
      { key: "returns.view", label: "View", description: "See return and cancellation requests, photos and timelines." },
      { key: "returns.manage", label: "Manage", description: "Change request status and add customer or internal notes." },
    ],
  },
  {
    key: "messages",
    label: "Messages",
    description: "Messages sent through the storefront contact form.",
    permissions: [
      { key: "messages.view", label: "View", description: "Read contact form messages." },
      { key: "messages.manage", label: "Manage", description: "Mark messages read or resolved and delete them." },
    ],
  },
  {
    key: "discounts",
    label: "Discounts",
    description: "Discount codes and automatic offers.",
    permissions: [
      { key: "discounts.view", label: "View", description: "See discounts." },
      { key: "discounts.manage", label: "Manage", description: "Create, edit, activate or deactivate discounts." },
      { key: "discounts.delete", label: "Delete", description: "Delete discounts." },
    ],
  },
  {
    key: "analytics",
    label: "Analytics",
    description: "Store traffic, funnel and search reports.",
    permissions: [
      { key: "analytics.view", label: "View", description: "See analytics and reports." },
    ],
  },
  {
    key: "taxes",
    label: "Taxes & GST",
    description: "GST settings, invoices and monthly reports.",
    permissions: [
      { key: "taxes.view", label: "View", description: "See GST reports and invoices." },
      { key: "taxes.manage", label: "Manage", description: "Change GSTIN, origin state and default rates." },
    ],
  },
  {
    key: "content",
    label: "Website content",
    description: "Announcements, launch offer, lookbook, edits, contact details, FAQs and policies.",
    permissions: [
      { key: "content.view", label: "View", description: "See the website content editor." },
      { key: "content.manage", label: "Manage", description: "Edit and publish storefront text, images and policies." },
    ],
  },
]

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_MODULES.flatMap((module) =>
  module.permissions.map((permission) => permission.key),
)

export function isPermissionKey(value: string): value is PermissionKey {
  return (ALL_PERMISSION_KEYS as string[]).includes(value)
}

export type PermissionSubject = {
  role: string | null | undefined
  permissions?: readonly string[] | null
}

/**
 * ADMIN always passes. SUB_ADMIN passes when the exact key is held, or, for a
 * `.view` key, when any key of the same module is held.
 */
export function hasPermission(subject: PermissionSubject, key: PermissionKey): boolean {
  if (subject.role === "ADMIN") return true
  if (subject.role !== "SUB_ADMIN") return false

  const held = subject.permissions ?? []
  if (held.includes(key)) return true

  const [module, level] = key.split(".") as [PermissionModuleKey, PermissionLevel]
  if (level === "view") {
    return held.some((candidate) => candidate.startsWith(`${module}.`))
  }
  return false
}

export function hasAnyPermission(subject: PermissionSubject, keys: PermissionKey[]) {
  return keys.some((key) => hasPermission(subject, key))
}

/** Drops unknown keys and de-duplicates. */
export function normalizePermissions(values: readonly string[]): PermissionKey[] {
  return [...new Set(values.filter(isPermissionKey))]
}

/**
 * Which `.view` permission unlocks each dashboard route prefix. Used by the
 * sidebar to hide modules the signed-in staff member cannot open; the server
 * enforces the same keys independently.
 */
export const DASHBOARD_ROUTE_PERMISSIONS: Array<{ prefix: string; permission: PermissionKey }> = [
  { prefix: "/dashboard/orders", permission: "orders.view" },
  { prefix: "/dashboard/products/collections", permission: "collections.view" },
  { prefix: "/dashboard/products/categories", permission: "categories.view" },
  { prefix: "/dashboard/products/inventory", permission: "inventory.view" },
  { prefix: "/dashboard/products", permission: "products.view" },
  { prefix: "/dashboard/customers", permission: "customers.view" },
  { prefix: "/dashboard/reviews", permission: "reviews.view" },
  { prefix: "/dashboard/returns", permission: "returns.view" },
  { prefix: "/dashboard/messages", permission: "messages.view" },
  { prefix: "/dashboard/discounts", permission: "discounts.view" },
  { prefix: "/dashboard/analytics", permission: "analytics.view" },
  { prefix: "/dashboard/taxes", permission: "taxes.view" },
  { prefix: "/dashboard/banners", permission: "banners.view" },
  { prefix: "/dashboard/content", permission: "content.view" },
]

export function permissionForRoute(url: string): PermissionKey | null {
  const match = DASHBOARD_ROUTE_PERMISSIONS.find(
    (entry) => url === entry.prefix || url.startsWith(`${entry.prefix}/`),
  )
  return match?.permission ?? null
}

export function canOpenRoute(subject: PermissionSubject, url: string): boolean {
  if (url.startsWith("/dashboard/settings")) return subject.role === "ADMIN"
  const permission = permissionForRoute(url)
  return permission ? hasPermission(subject, permission) : subject.role === "ADMIN" || subject.role === "SUB_ADMIN"
}
