"use client"

import Image from "next/image"
import { useState, type ReactNode } from "react"
import { ChevronDown, ImageOff } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  BADGE_OPTIONS,
  CARE_OPTIONS,
  COMPLETE_LOOK_MAX,
  EDIT_OPTIONS,
  GENDER_OPTIONS,
  IMAGE_ROLES,
  PRODUCT_HIGHLIGHT_COUNT,
  PRODUCT_STRIP_COUNT,
  SIZE_CHART_OPTIONS,
  SPEC_FIELDS,
  type ImageRole,
  type ProductHighlight,
  type ProductPageContent,
} from "@/lib/product-page-content"
import { cn } from "@/lib/utils"

type MediaOption = { objectKey: string; url: string | null; name: string }
export type ProductOption = { id: string; title: string; status: string }
export type DiscountCodeOption = { code: string; title: string; isActive: boolean }

const fieldClass =
  "border-black/20 bg-white shadow-none focus-visible:border-black/45 focus-visible:ring-black/10"
const selectClass =
  "h-9 w-full rounded-md border border-black/20 bg-white px-2 text-sm shadow-none focus-visible:border-black/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10"

/** A collapsible admin card. */
function Panel({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string
  hint: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-start justify-between gap-4 px-4 py-4 text-left"
      >
        <span>
          <span className="block text-sm font-semibold text-black/75">{title}</span>
          <span className="mt-1 block text-xs leading-5 text-black/50">{hint}</span>
        </span>
        <ChevronDown className={cn("mt-0.5 size-4 shrink-0 text-black/40 transition-transform", open && "rotate-180")} />
      </button>
      {open ? <div className="grid gap-4 border-t border-black/10 px-4 py-4">{children}</div> : null}
    </section>
  )
}

function Labeled({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm text-black/75">
      {label}
      {children}
      {hint ? <span className="text-xs text-black/45">{hint}</span> : null}
    </label>
  )
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-black" />
      <span>
        <span className="block text-sm text-black/75">{label}</span>
        <span className="block text-xs text-black/45">{hint}</span>
      </span>
    </label>
  )
}

/** Picks one of the product's uploaded Media images (or none). */
function MediaPicker({
  label,
  media,
  value,
  onChange,
}: {
  label: string
  media: MediaOption[]
  value: string
  onChange: (objectKey: string) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      <button
        type="button"
        role="radio"
        aria-checked={!value}
        onClick={() => onChange("")}
        className={`flex size-14 cursor-pointer items-center justify-center rounded-md border text-black/40 ${!value ? "border-black ring-1 ring-black" : "border-black/15 hover:border-black/40"}`}
        title="No image"
      >
        <ImageOff className="size-4" />
      </button>
      {media.map((image) => {
        const selected = image.objectKey === value
        return (
          <button
            key={image.objectKey}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={image.name}
            onClick={() => onChange(image.objectKey)}
            className={`relative size-14 cursor-pointer overflow-hidden rounded-md border bg-black/[0.03] ${selected ? "border-black ring-1 ring-black" : "border-black/15 hover:border-black/40"}`}
          >
            {image.url ? <Image src={image.url} alt="" fill sizes="56px" className="object-cover" /> : null}
          </button>
        )
      })}
    </div>
  )
}

/** Searchable multi-select of other products, kept in pick order. */
function ProductPicker({
  label,
  options,
  value,
  max,
  onChange,
}: {
  label: string
  options: ProductOption[]
  value: string[]
  max: number
  onChange: (ids: string[]) => void
}) {
  const [query, setQuery] = useState("")
  const byId = new Map(options.map((o) => [o.id, o]))
  const matches = options
    .filter((o) => !value.includes(o.id) && o.title.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 8)
  const full = value.length >= max

  return (
    <div className="grid gap-2">
      <p className="text-sm text-black/75">
        {label} <span className="text-xs text-black/45">({value.length}/{max})</span>
      </p>
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-black/[0.06] py-1 pl-3 pr-1 text-xs text-black/75">
              {byId.get(id)?.title ?? "Removed product"}
              {byId.get(id) && byId.get(id)?.status !== "ACTIVE" ? <span className="text-amber-700">(not active)</span> : null}
              <button
                type="button"
                aria-label="Remove"
                onClick={() => onChange(value.filter((v) => v !== id))}
                className="grid size-5 cursor-pointer place-items-center rounded-full hover:bg-black/10"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {!full ? (
        <>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products to add" className={fieldClass} />
          {query.trim() ? (
            <div className="grid gap-1 rounded-md border border-black/10 p-1">
              {matches.length === 0 ? <p className="px-2 py-1.5 text-xs text-black/45">No matching products.</p> : null}
              {matches.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onChange([...value, o.id])
                    setQuery("")
                  }}
                  className="cursor-pointer rounded px-2 py-1.5 text-left text-sm hover:bg-black/[0.04]"
                >
                  {o.title}
                  {o.status !== "ACTIVE" ? <span className="ml-1 text-xs text-amber-700">({o.status.toLowerCase()})</span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export function ProductPageContentSection({
  value,
  media,
  imageAlts,
  onImageAltChange,
  productOptions,
  discountCodes,
  onChange,
}: {
  value: ProductPageContent
  media: MediaOption[]
  imageAlts: Record<string, string>
  onImageAltChange: (objectKey: string, alt: string) => void
  productOptions: ProductOption[]
  discountCodes: DiscountCodeOption[]
  onChange: (next: ProductPageContent) => void
}) {
  const set = <K extends keyof ProductPageContent>(key: K, next: ProductPageContent[K]) =>
    onChange({ ...value, [key]: next })

  const highlights: ProductHighlight[] = Array.from(
    { length: PRODUCT_HIGHLIGHT_COUNT },
    (_, index) => value.highlights[index] ?? { imageKey: "", title: "", text: "" },
  )
  const setHighlight = (index: number, patch: Partial<ProductHighlight>) =>
    set("highlights", highlights.map((h, i) => (i === index ? { ...h, ...patch } : h)))

  const strip = Array.from({ length: PRODUCT_STRIP_COUNT }, (_, index) => value.highlightStrip[index] ?? { title: "", text: "" })
  const setStrip = (index: number, patch: Partial<(typeof strip)[number]>) =>
    set("highlightStrip", strip.map((t, i) => (i === index ? { ...t, ...patch } : t)))

  // A picked image that was later removed from Media no longer counts.
  const mediaKeys = new Set(media.map((image) => image.objectKey))
  const keyOrEmpty = (key: string) => (mediaKeys.has(key) ? key : "")

  return (
    <>
      <Panel title="Identity" hint="Short name above the headline, edit, article code, gender and colour." defaultOpen>
        <div className="grid gap-4 sm:grid-cols-2">
          <Labeled label="Short name" hint='Small grey name above the headline, e.g. "Faded Years". Also used on product cards.'>
            <Input value={value.shortName} onChange={(e) => set("shortName", e.target.value)} placeholder="Faded Years" className={fieldClass} />
          </Labeled>
          <Labeled label="Edit / line">
            <select className={selectClass} value={value.edit} onChange={(e) => set("edit", e.target.value)}>
              <option value="">Not set</option>
              {EDIT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Labeled>
          <Labeled label="Article code">
            <Input value={value.articleCode} onChange={(e) => set("articleCode", e.target.value)} placeholder="SU12/2026-27" className={fieldClass} />
          </Labeled>
          <Labeled label="Gender" hint="Used in the breadcrumb (Homepage › Men › …).">
            <select className={selectClass} value={value.gender} onChange={(e) => set("gender", e.target.value as ProductPageContent["gender"])}>
              <option value="">Not set</option>
              {GENDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Labeled>
          <Labeled label="Colour name" hint='Shown as "Colour: Grey Cirrus".'>
            <Input value={value.colourName} onChange={(e) => set("colourName", e.target.value)} placeholder="Grey Cirrus" className={fieldClass} />
          </Labeled>
          <Labeled label="Subtitle" hint="One line under the headline. The headline itself is the Title above.">
            <Input value={value.subtitle} onChange={(e) => set("subtitle", e.target.value)} placeholder="A classic bootcut silhouette with a softly faded finish…" className={fieldClass} />
          </Labeled>
        </div>
      </Panel>

      <Panel title="Specs (Features list)" hint="Shown as the FEATURES list under Features & Care, in this order. Empty fields are skipped.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SPEC_FIELDS.map((field) => (
            <Labeled key={field.key} label={field.label}>
              {field.options ? (
                <select
                  className={selectClass}
                  value={value.specs[field.key] ?? ""}
                  onChange={(e) => set("specs", { ...value.specs, [field.key]: e.target.value })}
                >
                  <option value="">Not set</option>
                  {/* Keep a value typed in earlier (e.g. via CSV) selectable. */}
                  {value.specs[field.key] && !field.options.includes(value.specs[field.key] as string) ? (
                    <option value={value.specs[field.key]}>{value.specs[field.key]}</option>
                  ) : null}
                  {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <Input
                  value={value.specs[field.key] ?? ""}
                  onChange={(e) => set("specs", { ...value.specs, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  className={fieldClass}
                />
              )}
            </Labeled>
          ))}
        </div>
      </Panel>

      <Panel title="Highlight strip" hint="Up to 4 tiles under the badges, e.g. STRAIGHT FIT / 100% COTTON / MID-RISE / SOFT WASHED. Empty tiles are hidden.">
        <Toggle
          checked={value.hideHighlightStrip}
          onChange={(v) => set("hideHighlightStrip", v)}
          label="Hide the highlight strip on this product"
          hint="Your text is kept. It can also be switched off for every product in Website content → Product page."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {strip.map((tile, index) => (
            <div key={index} className="grid gap-2 rounded-lg border border-black/10 p-3">
              <p className="text-xs font-semibold text-black/60">Tile {index + 1}</p>
              <Input aria-label={`Tile ${index + 1} title`} value={tile.title} onChange={(e) => setStrip(index, { title: e.target.value })} placeholder="STRAIGHT FIT" className={fieldClass} />
              <Input aria-label={`Tile ${index + 1} line`} value={tile.text} onChange={(e) => setStrip(index, { text: e.target.value })} placeholder="Clean line from hip to hem" className={fieldClass} />
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="The Fit & Care" hint="Fit headline and paragraph, plus care instructions as tick-boxes.">
        <Labeled label="Fit headline">
          <Input value={value.fitHeadline} onChange={(e) => set("fitHeadline", e.target.value)} placeholder="CLEAN UP TOP. EASY THROUGH THE HEM." className={fieldClass} />
        </Labeled>
        <Labeled label="Fit paragraph">
          <Textarea value={value.fitText} onChange={(e) => set("fitText", e.target.value)} className={`min-h-20 resize-y py-2 ${fieldClass}`} />
        </Labeled>
        <div className="grid gap-2">
          <p className="text-sm text-black/75">Care instructions</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CARE_OPTIONS.map((option) => (
              <label key={option} className="flex cursor-pointer items-center gap-2 text-sm text-black/70">
                <input
                  type="checkbox"
                  className="size-4 accent-black"
                  checked={value.care.includes(option)}
                  onChange={(e) =>
                    set("care", e.target.checked ? [...value.care, option] : value.care.filter((c) => c !== option))
                  }
                />
                {option}
              </label>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title="Model & size" hint='"Model is 5′9″ wearing a size 32", the fit note, and which size chart "Discover your Size" opens.'>
        <div className="grid gap-4 sm:grid-cols-3">
          <Labeled label="Model height">
            <Input value={value.modelHeight} onChange={(e) => set("modelHeight", e.target.value)} placeholder={`5'9"`} className={fieldClass} />
          </Labeled>
          <Labeled label="Size worn">
            <Input value={value.modelSize} onChange={(e) => set("modelSize", e.target.value)} placeholder="32" className={fieldClass} />
          </Labeled>
          <Labeled label="Measurements (optional)">
            <Input value={value.modelMeasurements} onChange={(e) => set("modelMeasurements", e.target.value)} placeholder="Waist 31″, chest 38″" className={fieldClass} />
          </Labeled>
        </div>
        <Labeled label="Fit note" hint='Shown as "Fit Note: …" under the sizes.'>
          <Input value={value.fitNote} onChange={(e) => set("fitNote", e.target.value)} placeholder="We recommend sizing down for all bootcut styles." className={fieldClass} />
        </Labeled>
        <Labeled label="Size chart" hint="Automatic picks it from the Fit spec (bootcut / straight), otherwise regular.">
          <select className={selectClass} value={value.sizeChart} onChange={(e) => set("sizeChart", e.target.value as ProductPageContent["sizeChart"])}>
            <option value="">Automatic</option>
            {SIZE_CHART_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Labeled>
      </Panel>

      <Panel title="Offers, badges & card" hint="Coupon cards under Add to Cart, return badges, sold count, and how the product card looks.">
        <div className="grid gap-2">
          <p className="text-sm text-black/75">Coupon cards</p>
          <p className="text-xs text-black/45">
            Pick codes to show. With none picked, every active order-wide code is shown. Expired or switched-off codes are never shown.
          </p>
          {discountCodes.length === 0 ? (
            <p className="text-xs text-black/45">No discount codes yet. Create them under Discounts.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {discountCodes.map((d) => (
                <label key={d.code} className="flex cursor-pointer items-center gap-2 text-sm text-black/70">
                  <input
                    type="checkbox"
                    className="size-4 accent-black"
                    checked={value.offerCodes.includes(d.code)}
                    disabled={!value.offerCodes.includes(d.code) && value.offerCodes.length >= 5}
                    onChange={(e) =>
                      set("offerCodes", e.target.checked ? [...value.offerCodes, d.code] : value.offerCodes.filter((c) => c !== d.code))
                    }
                  />
                  <span className="font-medium">{d.code}</span>
                  <span className="truncate text-black/45">{d.title}</span>
                  {!d.isActive ? <span className="text-xs text-amber-700">(inactive)</span> : null}
                </label>
              ))}
            </div>
          )}
        </div>
        <Labeled label="Bundle line (optional)" hint="Plain text shown under the coupons. It doesn't apply a discount by itself.">
          <Input value={value.bundleLine} onChange={(e) => set("bundleLine", e.target.value)} placeholder="Add 1 more and get 20% off" className={fieldClass} />
        </Labeled>
        <Toggle
          checked={value.hideReturnBadges}
          onChange={(v) => set("hideReturnBadges", v)}
          label="Hide the returns / exchanges badges on this product"
          hint="For products that can't be returned. The badge text is set in Website content → Product page."
        />
        <Toggle
          checked={value.showSoldCount}
          onChange={(v) => set("showSoldCount", v)}
          label="Show units sold"
          hint="Counted from real orders (cancelled orders excluded). Hidden while the count is 0."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Labeled label="Card badge" hint="Empty = taken from the tags.">
            <select className={selectClass} value={value.badge} onChange={(e) => set("badge", e.target.value)}>
              <option value="">From tags</option>
              {BADGE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Labeled>
          <div className="grid gap-1.5">
            <p className="text-sm text-black/75">Card hover image</p>
            <MediaPicker label="Card hover image" media={media} value={keyOrEmpty(value.hoverImageKey)} onChange={(k) => set("hoverImageKey", k)} />
          </div>
        </div>
      </Panel>

      <Panel title="Related products" hint="“More from [collection]” fills itself from the product's first collection. Recently viewed is automatic.">
        <ProductPicker
          label="Complete the look"
          options={productOptions}
          value={value.completeLookIds}
          max={COMPLETE_LOOK_MAX}
          onChange={(ids) => set("completeLookIds", ids)}
        />
        <ProductPicker
          label="You may also like (empty = newest products)"
          options={productOptions}
          value={value.alsoLikeIds}
          max={12}
          onChange={(ids) => set("alsoLikeIds", ids)}
        />
      </Panel>

      <Panel title="Images: alt text & role" hint="Alt text describes each photo for screen readers and Google. Lifestyle and hover-only images are left out of the main gallery.">
        {media.length === 0 ? <p className="text-xs text-black/45">Upload images under Media first.</p> : null}
        {media.map((image) => (
          <div key={image.objectKey} className="grid items-center gap-2 sm:grid-cols-[56px_minmax(0,1fr)_170px]">
            <div className="relative size-14 overflow-hidden rounded-md border border-black/10 bg-black/[0.03]">
              {image.url ? <Image src={image.url} alt="" fill sizes="56px" className="object-cover" /> : null}
            </div>
            <Input
              aria-label="Alt text"
              value={imageAlts[image.objectKey] ?? ""}
              onChange={(e) => onImageAltChange(image.objectKey, e.target.value)}
              placeholder="e.g. Front view of grey bootcut jeans"
              className={fieldClass}
            />
            <select
              aria-label="Image role"
              className={selectClass}
              value={value.imageRoles[image.objectKey] ?? "gallery"}
              onChange={(e) => {
                const role = e.target.value as ImageRole
                const roles = { ...value.imageRoles }
                if (role === "gallery") delete roles[image.objectKey]
                else roles[image.objectKey] = role
                set("imageRoles", roles)
              }}
            >
              {IMAGE_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        ))}
      </Panel>

      <Panel title="“It’s in the Details” & lifestyle image" hint="Up to 3 close-ups with numbered captions, and the full-width image below You May Also Like.">
        <Labeled label="Intro text">
          <Textarea value={value.highlightsIntro} onChange={(e) => set("highlightsIntro", e.target.value)} placeholder="Considered cuts. Timeless washes." className={`min-h-9 resize-y py-2 ${fieldClass}`} />
        </Labeled>
        {highlights.map((highlight, index) => (
          <div key={index} className="grid gap-2 rounded-lg border border-black/10 p-3">
            <p className="text-xs font-semibold text-black/60">Detail {String(index + 1).padStart(2, "0")}</p>
            <MediaPicker label={`Image for detail ${index + 1}`} media={media} value={keyOrEmpty(highlight.imageKey)} onChange={(imageKey) => setHighlight(index, { imageKey })} />
            <div className="grid gap-2 sm:grid-cols-[minmax(140px,0.6fr)_minmax(0,1.4fr)]">
              <Input aria-label={`Title for detail ${index + 1}`} value={highlight.title} onChange={(e) => setHighlight(index, { title: e.target.value })} placeholder="The Bootcut" className={fieldClass} />
              <Textarea aria-label={`Text for detail ${index + 1}`} value={highlight.text} onChange={(e) => setHighlight(index, { text: e.target.value })} placeholder="A clean upper leg opens gradually towards the hem." className={`min-h-9 resize-y py-2 ${fieldClass}`} />
            </div>
          </div>
        ))}
        <div className="grid gap-1.5">
          <p className="text-sm text-black/75">Lifestyle image</p>
          <MediaPicker label="Lifestyle image" media={media} value={keyOrEmpty(value.lifestyleImageKey)} onChange={(k) => set("lifestyleImageKey", k)} />
        </div>
      </Panel>

      <Panel title="Shipping & origin text (this product only)" hint="Leave empty to use the shared text from Website content → Product page.">
        <Labeled label="Shipping, Returns & Exchanges override" hint="One point per line.">
          <Textarea value={value.shippingOverride} onChange={(e) => set("shippingOverride", e.target.value)} className={`min-h-20 resize-y py-2 ${fieldClass}`} />
        </Labeled>
        <Labeled label="Origin & Contact override">
          <Textarea value={value.originOverride} onChange={(e) => set("originOverride", e.target.value)} className={`min-h-16 resize-y py-2 ${fieldClass}`} />
        </Labeled>
      </Panel>
    </>
  )
}
