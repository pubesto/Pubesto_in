"use client"

import { Store } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { ProductPageContent } from "@/lib/product-page-content"

const fieldClass =
  "border-black/20 bg-white text-sm shadow-none focus-visible:border-black/45 focus-visible:ring-black/10"

/**
 * Pubesto product-page fields: badge, the line under the title, key
 * highlights, fallback rating and an optional video. Color swatches are set
 * in the Variants section; specifications live in "Additional details".
 */
export function ProductStorefrontSection({
  value,
  onChange,
  media = [],
}: {
  value: ProductPageContent
  onChange: (next: ProductPageContent) => void
  /** Product images, for choosing which photo each color shows. */
  media?: { objectKey: string; url: string | null; name: string }[]
}) {
  const colors = Object.keys(value.colorSwatches)
  const set = <K extends keyof ProductPageContent>(key: K, next: ProductPageContent[K]) =>
    onChange({ ...value, [key]: next })

  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
      <div className="flex items-start gap-3 px-4 py-4">
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-black/[0.045] text-black/55">
          <Store className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-black/75">Storefront details</h2>
          <p className="mt-1 text-xs text-black/50">
            What shoppers see on the product page and product cards. Specifications go in
            &ldquo;Additional details&rdquo; below.
          </p>
        </div>
      </div>
      <div className="grid gap-4 border-t border-black/10 px-4 py-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs text-black/75">
          <span className="font-medium">Badge</span>
          <Input
            value={value.badge}
            maxLength={30}
            placeholder="Auto: shows the discount, e.g. 20% OFF"
            onChange={(event) => set("badge", event.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="grid gap-1.5 text-xs text-black/75">
          <span className="font-medium">Line under the title</span>
          <Input
            value={value.detailLine}
            maxLength={160}
            placeholder="Fast & Efficient Cooling"
            onChange={(event) => set("detailLine", event.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="grid gap-1.5 text-xs text-black/75 sm:col-span-2">
          <span className="font-medium">Key highlights</span>
          <Textarea
            rows={5}
            value={value.bulletHighlights.join("\n")}
            placeholder={"360° surround airflow\nBladeless — safe for long hair\nUSB rechargeable, up to 8 hours"}
            onChange={(event) =>
              set(
                "bulletHighlights",
                event.target.value.split("\n").map((line) => line.replace(/^[\s\-*•]+/, "")).slice(0, 15),
              )
            }
            onBlur={() => set("bulletHighlights", value.bulletHighlights.map((line) => line.trim()).filter(Boolean))}
            className={fieldClass}
          />
          <span className="text-black/50">One per line.</span>
        </label>
        <label className="grid gap-1.5 text-xs text-black/75">
          <span className="font-medium">Rating shown before reviews arrive</span>
          <Input
            value={value.rating}
            inputMode="decimal"
            maxLength={4}
            placeholder="4.8"
            onChange={(event) => set("rating", event.target.value.replace(/[^\d.]/g, ""))}
            className={fieldClass}
          />
        </label>
        <label className="grid gap-1.5 text-xs text-black/75">
          <span className="font-medium">Review count shown before reviews arrive</span>
          <Input
            value={value.reviewCount}
            inputMode="numeric"
            maxLength={10}
            placeholder="45"
            onChange={(event) => set("reviewCount", event.target.value.replace(/\D/g, ""))}
            className={fieldClass}
          />
        </label>
        {colors.length > 0 && media.length > 0 ? (
          <div className="grid gap-2 text-xs text-black/75 sm:col-span-2">
            <span className="font-medium">Photo shown for each color</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {colors.map((color) => {
                const selected = value.colorImages[color] ?? ""
                const preview = media.find((image) => image.objectKey === selected)?.url
                return (
                  <label key={color} className="flex items-center gap-2 rounded-lg border border-black/10 p-2">
                    <span
                      aria-hidden="true"
                      className="size-4 shrink-0 rounded-sm ring-1 ring-inset ring-black/15"
                      style={{ backgroundColor: value.colorSwatches[color] }}
                    />
                    <span className="w-24 shrink-0 truncate font-medium">{color}</span>
                    <select
                      value={selected}
                      onChange={(event) =>
                        set("colorImages", { ...value.colorImages, [color]: event.target.value })
                      }
                      className="h-8 min-w-0 flex-1 rounded-md border border-black/20 bg-white px-2 text-xs"
                    >
                      <option value="">Main photo</option>
                      {media.map((image, index) => (
                        <option key={image.objectKey} value={image.objectKey}>
                          Photo {index + 1}{image.name ? ` · ${image.name}` : ""}
                        </option>
                      ))}
                    </select>
                    {preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={preview} alt="" className="size-8 shrink-0 rounded object-cover" />
                    ) : null}
                  </label>
                )
              })}
            </div>
          </div>
        ) : null}
        <label className="grid gap-1.5 text-xs text-black/75 sm:col-span-2">
          <span className="font-medium">Product video URL (optional)</span>
          <Input
            value={value.videoUrl}
            maxLength={500}
            placeholder="https://… .mp4 or /videos/neck-fan.mp4"
            onChange={(event) => set("videoUrl", event.target.value)}
            className={fieldClass}
          />
        </label>
      </div>
    </section>
  )
}
