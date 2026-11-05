"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Boxes, GripVertical, MoreHorizontal, Palette, Plus, Ruler, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type OptionName = "color" | "size"

export type ProductVariantDraft = {
  title: string
  price: number
  compareAtPrice: number | null
  inventoryQuantity: number
  optionValues: Record<string, any>
}

const optionDetails = {
  color: { label: "Color", placeholder: "e.g. Black", icon: Palette },
  size: { label: "Size", placeholder: "e.g. Medium", icon: Ruler },
} as const

const colorSwatches: Record<string, string> = {
  black: "#171717",
  white: "#ffffff",
  red: "#ef2b2d",
  blue: "#2563eb",
  green: "#16a34a",
  yellow: "#eab308",
  orange: "#f97316",
  olive: "#808000",
  purple: "#9333ea",
  pink: "#ec4899",
  brown: "#8b5e3c",
  beige: "#d6c3a5",
  cream: "#f5ead2",
  gray: "#6b7280",
  grey: "#6b7280",
  navy: "#1e3a5f",
  teal: "#0f766e",
  cyan: "#06b6d4",
  aqua: "#06b6d4",
  lime: "#84cc16",
  maroon: "#7f1d1d",
  gold: "#d4a017",
  silver: "#a8a8a8",
}

function getColorSwatch(value: string, customSwatch?: string) {
  if (customSwatch) return customSwatch
  const normalized = value.trim().toLowerCase()
  if (/^#[0-9a-f]{3,8}$/i.test(normalized)) return normalized
  return colorSwatches[normalized] ?? "#d1d5db"
}

function normalizeOptionValue(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

// Pubesto sells real color variants (each with its own stock), so every
// color x size combination is a separate variant.
function variantKey(color: string, size: string) {
  return `${color.toLowerCase()}::${size.toLowerCase()}`
}

function readOption(optionValues: Record<string, any>, name: string): string {
  const entry = Object.entries(optionValues ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase())
  const value = entry?.[1]
  if (typeof value === "string") return normalizeOptionValue(value)
  if (value && typeof value === "object") {
    const candidate = value.name ?? value.value ?? value.label
    if (typeof candidate === "string") return normalizeOptionValue(candidate)
  }
  return ""
}

function getInitialVariantState(initialVariants: ProductVariantDraft[]) {
  const colors: string[] = []
  const sizes: string[] = []
  const prices: Record<string, string> = {}
  const compareAtPrices: Record<string, string> = {}
  const quantities: Record<string, string> = {}

  for (const variant of initialVariants) {
    const color = readOption(variant.optionValues, "color")
    const size = readOption(variant.optionValues, "size")
    if (!color && !size) continue
    const key = variantKey(color, size)

    if (color && !colors.some((current) => current.toLowerCase() === color.toLowerCase())) {
      colors.push(color)
    }
    if (size && !sizes.some((current) => current.toLowerCase() === size.toLowerCase())) {
      sizes.push(size)
    }

    prices[key] = variant.price.toFixed(2)
    compareAtPrices[key] = variant.compareAtPrice?.toFixed(2) ?? ""
    quantities[key] = String(variant.inventoryQuantity)
  }

  return {
    enabledOptions: { color: colors.length > 0, size: sizes.length > 0 },
    values: { color: colors, size: sizes },
    prices,
    compareAtPrices,
    quantities,
  }
}

export function ProductVariantsSection({
  fallbackPrice = "0",
  fallbackCompareAtPrice = "",
  fallbackInventoryQuantity = "0",
  initialVariants = [],
  initialSwatches = {},
  onChange,
  onSwatchesChange,
}: {
  fallbackPrice?: string
  fallbackCompareAtPrice?: string
  fallbackInventoryQuantity?: string
  initialVariants?: ProductVariantDraft[]
  /** Color name -> hex, shown as swatches on the storefront. */
  initialSwatches?: Record<string, string>
  onChange?: (variants: ProductVariantDraft[]) => void
  onSwatchesChange?: (swatches: Record<string, string>) => void
}) {
  const [enabledOptions, setEnabledOptions] = useState<Record<OptionName, boolean>>(
    () => getInitialVariantState(initialVariants).enabledOptions,
  )
  const [values, setValues] = useState<Record<OptionName, string[]>>(
    () => getInitialVariantState(initialVariants).values,
  )
  const [drafts, setDrafts] = useState<Record<OptionName, string>>({ color: "", size: "" })
  const [quantities, setQuantities] = useState<Record<string, string>>(
    () => getInitialVariantState(initialVariants).quantities,
  )
  const [prices, setPrices] = useState<Record<string, string>>(
    () => getInitialVariantState(initialVariants).prices,
  )
  const [compareAtPrices, setCompareAtPrices] = useState<Record<string, string>>(
    () => getInitialVariantState(initialVariants).compareAtPrices,
  )
  const [selectedVariantKeys, setSelectedVariantKeys] = useState<string[]>([])
  const [customSwatches, setCustomSwatches] = useState<Record<string, string>>(initialSwatches)
  const [removedKeys, setRemovedKeys] = useState<string[]>([])
  const selectedColorRef = useRef("#000000")
  const colorPickerTouchedRef = useRef(false)
  const [headerPickerOpen, setHeaderPickerOpen] = useState(false)
  const [inlinePickerOpen, setInlinePickerOpen] = useState(false)
  const [draggedValue, setDraggedValue] = useState<{ option: OptionName; value: string } | null>(null)
  const [optionOrder, setOptionOrder] = useState<OptionName[]>(["color", "size"])
  const [draggedOption, setDraggedOption] = useState<OptionName | null>(null)
  const [editingValue, setEditingValue] = useState<{ option: OptionName; value: string } | null>(null)
  const [valueDraft, setValueDraft] = useState("")

  const activeOptions = optionOrder.filter((option) => enabledOptions[option])
  const availableOptions = (["color", "size"] as OptionName[]).filter((option) => !enabledOptions[option])

  const variants = useMemo(() => {
    if (values.color.length === 0 && values.size.length === 0) return []

    const colors = values.color.length > 0 ? values.color : [""]
    const sizes = values.size.length > 0 ? values.size : [""]
    return colors
      .flatMap((color) =>
        sizes.map((size) => {
          const label = [color, size].filter(Boolean).join(" / ")
          return { key: variantKey(color, size), color, size, label, accessibleLabel: label }
        }),
      )
      .filter((variant) => !removedKeys.includes(variant.key))
  }, [values.color, values.size, removedKeys])

  const variantDrafts = useMemo<ProductVariantDraft[]>(() => {
    const fallbackPriceNumber = Number(fallbackPrice)
    const fallbackCompareAtPriceNumber = Number(fallbackCompareAtPrice)
    const fallbackInventoryNumber = Number(fallbackInventoryQuantity)

    return variants.map((variant) => {
      const enteredPrice = Number(prices[variant.key])
      const enteredCompareAtPrice = Number(compareAtPrices[variant.key])
      const enteredQuantity = Number(quantities[variant.key])
      const optionValues: Record<string, string> = {}

      if (variant.color) optionValues.Color = variant.color
      if (variant.size) optionValues.Size = variant.size

      return {
        title: variant.label,
        price: Number.isFinite(enteredPrice) && prices[variant.key] !== ""
          ? enteredPrice
          : Number.isFinite(fallbackPriceNumber)
            ? fallbackPriceNumber
            : 0,
        compareAtPrice:
          compareAtPrices[variant.key] !== "" && Number.isFinite(enteredCompareAtPrice)
            ? enteredCompareAtPrice
            : fallbackCompareAtPrice !== "" && Number.isFinite(fallbackCompareAtPriceNumber)
              ? fallbackCompareAtPriceNumber
              : null,
        inventoryQuantity:
          Number.isFinite(enteredQuantity) && quantities[variant.key] !== ""
            ? Math.max(0, Math.trunc(enteredQuantity))
            : Number.isFinite(fallbackInventoryNumber)
              ? Math.max(0, Math.trunc(fallbackInventoryNumber))
              : 0,
        optionValues,
      }
    })
  }, [compareAtPrices, fallbackCompareAtPrice, fallbackInventoryQuantity, fallbackPrice, prices, quantities, variants])

  useEffect(() => {
    onChange?.(variantDrafts)
  }, [onChange, variantDrafts])

  const swatchesForColors = useMemo(
    () => Object.fromEntries(values.color.map((color) => [color, getColorSwatch(color, customSwatches[color])])),
    [customSwatches, values.color],
  )
  useEffect(() => {
    onSwatchesChange?.(swatchesForColors)
  }, [onSwatchesChange, swatchesForColors])

  const totalInventory = variants.reduce((total, variant) => total + (Number(quantities[variant.key]) || 0), 0)
  const allVariantsSelected = variants.length > 0 && variants.every((variant) => selectedVariantKeys.includes(variant.key))

  function addOption(option: OptionName) {
    setEnabledOptions((current) => ({ ...current, [option]: true }))
  }

  function removeOption(option: OptionName) {
    setEnabledOptions((current) => ({ ...current, [option]: false }))
    setValues((current) => ({ ...current, [option]: [] }))
    setDrafts((current) => ({ ...current, [option]: "" }))
  }

  function addValue(option: OptionName) {
    const nextValue = normalizeOptionValue(drafts[option])
    if (!nextValue || values[option].some((value) => value.toLowerCase() === nextValue.toLowerCase())) return

    setValues((current) => ({ ...current, [option]: [...current[option], nextValue] }))
    if (option === "color" && colorPickerTouchedRef.current) {
      setCustomSwatches((current) => ({ ...current, [nextValue]: selectedColorRef.current }))
      colorPickerTouchedRef.current = false
    }
    setDrafts((current) => ({ ...current, [option]: "" }))
  }

  function removeValue(option: OptionName, value: string) {
    setValues((current) => ({ ...current, [option]: current[option].filter((item) => item !== value) }))
    if (option === "color") setCustomSwatches((current) => {
      const next = { ...current }
      delete next[value]
      return next
    })
  }

  function moveValue(option: OptionName, source: string, target: string) {
    if (source === target) return

    setValues((current) => {
      const next = [...current[option]]
      const sourceIndex = next.indexOf(source)
      const targetIndex = next.indexOf(target)
      if (sourceIndex < 0 || targetIndex < 0) return current

      next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, source)
      return { ...current, [option]: next }
    })
  }

  function moveOption(source: OptionName, target: OptionName) {
    if (source === target) return

    setOptionOrder((current) => {
      const next = [...current]
      const sourceIndex = next.indexOf(source)
      const targetIndex = next.indexOf(target)
      next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, source)
      return next
    })
  }

  function startEditingValue(option: OptionName, value: string) {
    setEditingValue({ option, value })
    setValueDraft(value)
  }

  function saveValue(option: OptionName, value: string) {
    const nextValue = normalizeOptionValue(valueDraft)
    const hasDuplicate = values[option].some((item) => item !== value && item.toLowerCase() === nextValue.toLowerCase())
    if (!nextValue || hasDuplicate) {
      setEditingValue(null)
      return
    }

    setValues((current) => ({ ...current, [option]: current[option].map((item) => item === value ? nextValue : item) }))
    if (option === "color" && value !== nextValue) {
      setCustomSwatches((current) => {
        const next = { ...current }
        if (next[value]) {
          next[nextValue] = next[value]
          delete next[value]
        }
        return next
      })
    }
    setEditingValue(null)
  }

  function deleteSelectedVariants() {
    setRemovedKeys((current) => [...new Set([...current, ...selectedVariantKeys])])
    setSelectedVariantKeys([])
  }

  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-4">
        <div>
          <h2 className="text-sm font-semibold text-black/75">Variants</h2>
          <p className="mt-1 text-xs text-black/50">Add color or size options. Every color / size combination has its own price and stock.</p>
        </div>
        <OptionPicker availableOptions={availableOptions} open={headerPickerOpen} onAdd={(option) => { addOption(option); setHeaderPickerOpen(false) }} onOpenChange={setHeaderPickerOpen} />
      </div>

      <div className="border-t border-black/10 px-4 py-4">
        {activeOptions.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-black/15">
            {activeOptions.map((option, index) => {
              const { label, placeholder, icon: Icon } = optionDetails[option]

              return (
                <div
                  key={option}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move"
                    setDraggedOption(option)
                  }}
                  onDragEnd={() => setDraggedOption(null)}
                  onDragOver={(event) => {
                    if (draggedOption) event.preventDefault()
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    if (draggedOption) moveOption(draggedOption, option)
                    setDraggedOption(null)
                  }}
                  className={`${index > 0 ? "border-t border-black/10" : ""} cursor-grab active:cursor-grabbing ${draggedOption === option ? "bg-black/[0.025]" : ""}`}
                >
                  <div className="flex items-start gap-2 px-3 py-3">
                    <span className="mt-1 shrink-0 text-black/30"><GripVertical className="size-4" aria-hidden="true" /></span>
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-black/[0.045] text-black/55"><Icon className="size-3.5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-black/75">{label}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {values[option].map((value) => (
                          <span
                            key={value}
                            draggable
                            title="Drag to reorder"
                            onDragStart={(event) => {
                              event.stopPropagation()
                              event.dataTransfer.effectAllowed = "move"
                              setDraggedValue({ option, value })
                            }}
                            onDragOver={(event) => {
                              if (draggedValue?.option === option) event.preventDefault()
                            }}
                            onDrop={(event) => {
                              event.preventDefault()
                              if (draggedValue?.option === option) moveValue(option, draggedValue.value, value)
                              setDraggedValue(null)
                            }}
                            onDragEnd={() => setDraggedValue(null)}
                            className={`inline-flex cursor-grab items-center gap-1 rounded bg-[#edf5ff] py-1 pl-2 pr-1 text-xs font-medium text-[#16446f] active:cursor-grabbing ${draggedValue?.option === option && draggedValue.value === value ? "opacity-45" : ""}`}
                          >
                            {option === "color" && (
                              <label className="relative size-3 shrink-0 cursor-pointer rounded-sm ring-1 ring-inset ring-black/15" style={{ backgroundColor: getColorSwatch(value, customSwatches[value]) }} title="Change swatch color">
                                <input
                                  type="color"
                                  aria-label={`Swatch color for ${value}`}
                                  value={getColorSwatch(value, customSwatches[value]).slice(0, 7)}
                                  onChange={(event) => setCustomSwatches((current) => ({ ...current, [value]: event.target.value }))}
                                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                                />
                              </label>
                            )}
                            {editingValue?.option === option && editingValue.value === value ? (
                              <Input
                                aria-label={`Edit ${value}`}
                                autoFocus
                                value={valueDraft}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => setValueDraft(event.target.value)}
                                onBlur={() => saveValue(option, value)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") saveValue(option, value)
                                  if (event.key === "Escape") setEditingValue(null)
                                }}
                                className="h-5 w-16 border-black/20 bg-white px-1 text-xs text-[#16446f] shadow-none focus-visible:border-[#16446f]/40 focus-visible:ring-[#16446f]/10"
                              />
                            ) : (
                              <button type="button" draggable={false} onClick={(event) => { event.stopPropagation(); startEditingValue(option, value) }} className="cursor-text text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16446f]/30" title="Click to edit">
                                {value}
                              </button>
                            )}
                            <button type="button" draggable={false} aria-label={`Remove ${value}`} onClick={() => removeValue(option, value)} className="grid size-4 cursor-pointer place-items-center rounded text-[#16446f]/60 transition-colors hover:bg-[#cfe4fa] hover:text-[#16446f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16446f]/30">
                              <X className="size-3" />
                            </button>
                          </span>
                        ))}
                        <div className="flex min-w-44 flex-1 items-center gap-1.5">
                          {option === "color" && (
                            <Input
                              aria-label="Choose custom color"
                              title="Choose a custom color"
                              type="color"
                              defaultValue="#000000"
                              draggable={false}
                              onChange={(event) => {
                                selectedColorRef.current = event.target.value
                                colorPickerTouchedRef.current = true
                              }}
                              onDragStart={(event) => event.stopPropagation()}
                              className="size-7 shrink-0 cursor-pointer rounded-md border-black/15 bg-white p-0.5 shadow-none"
                            />
                          )}
                          <Input
                            aria-label={`Add ${label.toLowerCase()} value`}
                            value={drafts[option]}
                            onChange={(event) => setDrafts((current) => ({ ...current, [option]: event.target.value }))}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault()
                                addValue(option)
                              }
                            }}
                            placeholder={values[option].length === 0 ? placeholder : `Add ${label.toLowerCase()}`}
                            className="h-7 min-w-0 flex-1 border-0 bg-transparent px-1.5 text-xs shadow-none placeholder:text-black/35 focus-visible:border-black/25 focus-visible:ring-2 focus-visible:ring-black/10"
                          />
                          <Button type="button" variant="ghost" size="icon-xs" aria-label={`Add ${label.toLowerCase()}`} onClick={() => addValue(option)} className="shrink-0 cursor-pointer text-black/55 hover:bg-black/[0.05] hover:text-black">
                            <Plus className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove ${label} option`} onClick={() => removeOption(option)} className="cursor-pointer text-black/40 hover:bg-red-50 hover:text-red-700">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
            {availableOptions.length > 0 && (
              <div className="border-t border-black/10 px-3 py-2">
                <OptionPicker availableOptions={availableOptions} open={inlinePickerOpen} onAdd={(option) => { addOption(option); setInlinePickerOpen(false) }} onOpenChange={setInlinePickerOpen} compact />
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-black/20 bg-black/[0.015] px-4 py-6 text-center">
            <Boxes className="mx-auto size-5 text-black/35" />
            <p className="mt-2 text-sm font-medium text-black/65">Create your first option</p>
            <p className="mt-1 text-xs text-black/45">Choose Color or Size to generate individual variants.</p>
          </div>
        )}
      </div>

      {variants.length > 0 ? (
        <div className="border-t border-black/10">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <h3 className="text-sm font-medium text-black/75">Variant inventory</h3>
              <p className="mt-0.5 text-xs text-black/50">Set selling price, compare-at price, and stock for each variant.</p>
            </div>
            <span className="rounded-full bg-black/[0.05] px-2 py-1 text-xs font-medium text-black/55">{variants.length} {variants.length === 1 ? "variant" : "variants"}</span>
          </div>
          <div className="overflow-hidden border-t border-black/10">
            <div>
              <div className="grid grid-cols-[18px_minmax(48px,1fr)_minmax(72px,1fr)_minmax(94px,1.25fr)_minmax(56px,0.8fr)] items-center gap-2 bg-black/[0.025] px-3 py-2 text-xs font-medium text-black/55 sm:grid-cols-[20px_minmax(80px,1fr)_minmax(100px,1fr)_minmax(132px,1.25fr)_minmax(82px,0.8fr)] sm:gap-3 sm:px-4">
                <Checkbox aria-label="Select all variants" checked={allVariantsSelected} onCheckedChange={(checked) => setSelectedVariantKeys(checked === true ? variants.map((variant) => variant.key) : [])} />
                <span className="flex items-center gap-1.5">
                  Variant
                  <span className="inline-flex size-6 shrink-0">
                    {selectedVariantKeys.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="outline" size="icon-xs" aria-label="Selected variant actions" className="size-6 cursor-pointer rounded-md border-black/20 bg-white text-black/70 shadow-xs hover:bg-black/[0.06] hover:text-black">
                            <MoreHorizontal className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-40">
                          <DropdownMenuItem variant="destructive" onSelect={deleteSelectedVariants}>
                            <Trash2 /> Delete variant{selectedVariantKeys.length > 1 ? "s" : ""}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </span>
                </span>
                <span>Price</span>
                <span>Compare-at price</span>
                <span>Available</span>
              </div>
              <div className="divide-y divide-black/10">
                {variants.map((variant) => (
                  <div key={variant.key} className="grid grid-cols-[18px_minmax(48px,1fr)_minmax(72px,1fr)_minmax(94px,1.25fr)_minmax(56px,0.8fr)] items-center gap-2 px-3 py-3 sm:grid-cols-[20px_minmax(80px,1fr)_minmax(100px,1fr)_minmax(132px,1.25fr)_minmax(82px,0.8fr)] sm:gap-3 sm:px-4">
                    <Checkbox aria-label={`Select ${variant.accessibleLabel}`} checked={selectedVariantKeys.includes(variant.key)} onCheckedChange={(checked) => setSelectedVariantKeys((current) => checked === true ? [...new Set([...current, variant.key])] : current.filter((key) => key !== variant.key))} />
                    <span className="truncate text-sm font-medium text-black/70">{variant.label}</span>
                    <span className="relative">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-black/50">₹</span>
                      <Input
                        aria-label={`${variant.accessibleLabel} price`}
                        inputMode="decimal"
                        placeholder="0.00"
                        type="text"
                        value={prices[variant.key] ?? ""}
                        onChange={(event) => setPrices((current) => ({ ...current, [variant.key]: event.target.value }))}
                        className="border-black/20 bg-white pl-6 text-sm shadow-none focus-visible:border-black/45 focus-visible:ring-black/10"
                      />
                    </span>
                    <span className="relative">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-black/50">₹</span>
                      <Input
                        aria-label={`${variant.accessibleLabel} compare-at price`}
                        inputMode="decimal"
                        placeholder="0.00"
                        type="text"
                        value={compareAtPrices[variant.key] ?? ""}
                        onChange={(event) => setCompareAtPrices((current) => ({ ...current, [variant.key]: event.target.value }))}
                        className="border-black/20 bg-white pl-6 text-sm shadow-none focus-visible:border-black/45 focus-visible:ring-black/10"
                      />
                    </span>
                    <Input
                      aria-label={`${variant.accessibleLabel} available stock`}
                      inputMode="numeric"
                      min="0"
                      placeholder="0"
                      type="number"
                      value={quantities[variant.key] ?? ""}
                      onChange={(event) => setQuantities((current) => ({ ...current, [variant.key]: event.target.value }))}
                      className="border-black/20 bg-white text-sm shadow-none focus-visible:border-black/45 focus-visible:ring-black/10"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="border-t border-black/10 bg-black/[0.015] px-4 py-3 text-xs text-black/60">Total variant inventory: <span className="font-semibold text-black/75">{totalInventory} available</span></div>
        </div>
      ) : activeOptions.length > 0 ? (
        <div className="border-t border-black/10 px-4 py-5 text-center text-sm text-black/45">Add at least one option value to create variants.</div>
      ) : null}
    </section>
  )
}

function OptionPicker({
  availableOptions,
  open,
  onAdd,
  onOpenChange,
  compact = false,
}: {
  availableOptions: OptionName[]
  open: boolean
  onAdd: (option: OptionName) => void
  onOpenChange: (open: boolean) => void
  compact?: boolean
}) {
  if (availableOptions.length === 0) return null

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant={compact ? "ghost" : "outline"} size="sm" className="cursor-pointer border-black/15 bg-white text-black/70 shadow-none hover:bg-black/[0.03]">
          <Plus className="size-3.5" /> {compact ? "Add another option" : "Add variant"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 gap-1 p-1.5">
        <p className="px-2 py-1 text-xs font-medium text-black/45">Add an option</p>
        {availableOptions.map((option) => {
          const { label, icon: Icon } = optionDetails[option]
          return (
            <button key={option} type="button" onClick={() => onAdd(option)} className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-black/75 transition-colors hover:bg-black/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15">
              <Icon className="size-4 text-black/50" />
              {label}
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
