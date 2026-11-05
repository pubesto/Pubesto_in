/**
 * Footer / contact details are stored as groups ("For customer care", …) of
 * typed lines, so any number of emails, phone and WhatsApp numbers can be
 * added from the admin. Shared by the storefront and the admin form.
 */
export type ContactLineType = "email" | "phone" | "whatsapp" | "text"

export type ContactLine = {
  type: ContactLineType
  /** Optional prefix shown before the value, e.g. "Customer Care". */
  label: string
  value: string
}

export type ContactGroup = {
  heading: string
  lines: ContactLine[]
}

export const CONTACT_LINE_TYPES: { value: ContactLineType; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "text", label: "Text" },
]

/** Digits only, keeping a leading "+". */
function phoneDigits(value: string) {
  const trimmed = value.trim()
  return (trimmed.startsWith("+") ? "+" : "") + trimmed.replace(/\D/g, "")
}

/** Where a line should link to, or null for plain text. */
export function contactLineHref(line: ContactLine): string | null {
  const value = line.value.trim()
  if (!value) return null
  switch (line.type) {
    case "email":
      return `mailto:${value}`
    case "phone":
      return `tel:${phoneDigits(value)}`
    case "whatsapp":
      // wa.me wants the full international number without "+" or spaces.
      return `https://wa.me/${phoneDigits(value).replace(/^\+/, "")}`
    default:
      return null
  }
}

export function isValidContactLine(line: ContactLine): boolean {
  const value = line.value.trim()
  if (!value) return false
  if (line.type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  if (line.type === "phone" || line.type === "whatsapp") return phoneDigits(value).replace("+", "").length >= 7
  return true
}

/** Converts the old fixed footer fields into groups (older saved content). */
export function contactGroupsFromLegacy(legacy: {
  careEmail?: unknown
  ordersPhone?: unknown
  timings?: unknown
}): ContactGroup[] {
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "")
  const groups: ContactGroup[] = []
  const email = text(legacy.careEmail)
  const phone = text(legacy.ordersPhone)
  const timings = text(legacy.timings)
  if (email) groups.push({ heading: "For customer care", lines: [{ type: "email", label: "", value: email }] })
  if (phone) {
    // "Customer Care: +91-… WhatsApp: +91-…" → one line per labelled number.
    const parts = [...phone.matchAll(/([A-Za-z][A-Za-z ]*?):\s*(\+?[\d\s()-]{7,})/g)]
    const lines: ContactLine[] = parts.length
      ? parts.map(([, label, number]) => ({
          type: /whats\s*app/i.test(label) ? "whatsapp" : "phone",
          label: label.trim(),
          value: number.trim(),
        }))
      : [{ type: /[a-z]/i.test(phone) ? "text" : "phone", label: "", value: phone }]
    groups.push({ heading: "For online orders", lines })
  }
  if (timings) groups.push({ heading: "Timings", lines: [{ type: "text", label: "", value: timings }] })
  return groups
}
