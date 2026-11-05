"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  CalendarDays,
  ChevronRight,
  CirclePlus,
  Clock3,
  Search,
  Tag,
} from "lucide-react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-black/10 bg-white p-4 shadow-sm ${className}`}>{children}</section>
}

const inputClass = "h-8 w-full rounded-lg border border-black/25 bg-white px-3 text-sm outline-none transition focus:border-black/55 focus:ring-2 focus:ring-black/5"
const selectClass = "h-8 w-full rounded-lg border-black/25 bg-white text-sm shadow-none focus:ring-2 focus:ring-black/5"

export type PickerKind = "collections" | "products"

type PickerOption = {
  id: string
  name: string
  image: string
  productCount?: number
  available?: number
  price?: string
}

const collectionOptions: PickerOption[] = [
  { id: "best-sellers", name: "BEST SELLERS", image: "product1.png", productCount: 29 },
  { id: "boots", name: "BOOTS", image: "product4.png", productCount: 12 },
  { id: "clothing", name: "CLOTHING", image: "product7.png", productCount: 44 },
  { id: "home-page", name: "HOME PAGE", image: "product5.png", productCount: 0 },
  { id: "jeans", name: "JEANS", image: "product3.png", productCount: 2 },
  { id: "korean-lowers", name: "KOREAN LOWERS", image: "product2.png", productCount: 11 },
  { id: "loafers", name: "LOAFERS", image: "product4.png", productCount: 22 },
  { id: "more-from-suos", name: "MORE FROM Pubesto", image: "product9.png", productCount: 12 },
]

const productOptions: PickerOption[] = [
  { id: "a1", name: "A1", image: "product1.png", available: 10, price: "₹7,999.00" },
  { id: "a2", name: "A2", image: "product2.png", available: 10, price: "₹7,999.00" },
  { id: "a3", name: "A3", image: "product3.png", available: 10, price: "₹7,999.00" },
  { id: "a4", name: "A4", image: "product4.png", available: 10, price: "₹7,999.00" },
  { id: "a5", name: "A5", image: "product5.png", available: 10, price: "₹7,999.00" },
  { id: "a6", name: "A6", image: "product6.png", available: 10, price: "₹7,999.00" },
  { id: "b1", name: "B1", image: "product7.png", available: 10, price: "₹7,999.00" },
  { id: "b2", name: "B2", image: "product8.png", available: 10, price: "₹7,999.00" },
]

export function TargetPickerDialog({
  kind,
  open,
  onOpenChange,
  selectedIds,
  onAdd,
}: {
  kind: PickerKind
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedIds: string[]
  onAdd: (ids: string[]) => void
}) {
  const [search, setSearch] = React.useState("")
  const [draftIds, setDraftIds] = React.useState<string[]>(selectedIds)
  const isCollections = kind === "collections"
  const options = isCollections ? collectionOptions : productOptions
  const visibleOptions = options.filter((option) => option.name.toLowerCase().includes(search.toLowerCase()))

  const setDialogOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraftIds(selectedIds)
      setSearch("")
    }
    onOpenChange(nextOpen)
  }

  const toggleOption = (id: string) => {
    setDraftIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  return (
    <Dialog open={open} onOpenChange={setDialogOpen}>
      <DialogContent className="w-[min(620px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[620px]" overlayClassName="bg-black/45">
        <DialogHeader className="border-b border-black/10 px-4 py-5"><DialogTitle className="text-base font-semibold">Add {isCollections ? "collections" : "products"}</DialogTitle><DialogDescription className="sr-only">Search and select {isCollections ? "collections" : "products"} to include in this discount.</DialogDescription></DialogHeader>
        <div className="p-4 pb-3"><div className="relative"><Search className="pointer-events-none absolute left-3 top-2 size-4 text-black/45" /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${isCollections ? "collections" : "products"}`} className={`${inputClass} pl-9`} /></div>{!isCollections ? <button type="button" className="mt-2 h-7 rounded-md border border-black/15 px-2 text-xs font-medium hover:bg-black/[0.03]">Add filter +</button> : null}</div>
        <div className="grid grid-cols-[minmax(0,1fr)_90px] border-y border-black/10 bg-black/[0.02] px-4 py-2 text-xs font-medium text-black/65">{isCollections ? <><span>Collection</span><span className="text-right">Products</span></> : <><span>Product</span><span className="text-right">Available</span></>}</div>
        <div className="max-h-[440px] overflow-y-auto">{visibleOptions.length ? visibleOptions.map((option) => <label key={option.id} className="grid cursor-pointer grid-cols-[24px_minmax(0,1fr)_90px] items-center gap-2 border-b border-black/[0.08] px-4 py-2.5 transition hover:bg-black/[0.025]"><input type="checkbox" checked={draftIds.includes(option.id)} onChange={() => toggleOption(option.id)} className="size-4 rounded accent-black" /><span className="flex min-w-0 items-center gap-3"><Image src={`/images/products/${option.image}`} alt="" width={40} height={40} className="size-10 rounded-lg border border-black/10 object-cover" /><span className="truncate text-sm font-medium text-black/85">{option.name}</span></span><span className="text-right text-sm text-black/75">{isCollections ? option.productCount : option.available}{!isCollections && option.price ? <span className="mt-1 block text-xs text-black/55">{option.price}</span> : null}</span></label>) : <p className="px-4 py-10 text-center text-sm text-black/55">No {isCollections ? "collections" : "products"} found.</p>}</div>
        <DialogFooter className="flex-row items-center justify-between border-t border-black/10 px-4 py-3 sm:justify-between"><p className="text-sm text-black/65">{draftIds.length}/100 {isCollections ? "collections" : "products"} selected</p><div className="flex gap-2"><button type="button" onClick={() => setDialogOpen(false)} className="h-8 rounded-lg border border-black/15 px-3 text-sm font-medium hover:bg-black/[0.03]">Cancel</button><button type="button" disabled={draftIds.length === 0} onClick={() => { onAdd(draftIds); setDialogOpen(false) }} className="h-8 rounded-lg bg-black px-3 text-sm font-medium text-white hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/15">Add</button></div></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AmountOffProductsEditor() {
  const [method, setMethod] = React.useState<"code" | "automatic">("code")
  const [code, setCode] = React.useState("")
  const [valueType, setValueType] = React.useState("percentage")
  const [value, setValue] = React.useState("")
  const [appliesTo, setAppliesTo] = React.useState("collections")
  const [collectionQuery, setCollectionQuery] = React.useState("")
  const [pickerKind, setPickerKind] = React.useState<PickerKind | null>(null)
  const [selectedCollections, setSelectedCollections] = React.useState<string[]>([])
  const [selectedProducts, setSelectedProducts] = React.useState<string[]>([])
  const [eligibility, setEligibility] = React.useState("all")
  const [minimum, setMinimum] = React.useState("none")
  const [limitTotal, setLimitTotal] = React.useState(false)
  const [limitCustomer, setLimitCustomer] = React.useState(false)
  const [showCombinations, setShowCombinations] = React.useState(false)
  const [tags, setTags] = React.useState("")
  const [saved, setSaved] = React.useState(false)

  const readyToSave = value.trim().length > 0 && (method === "automatic" || code.trim().length > 0)
  const markUnsaved = () => setSaved(false)

  const generateCode = () => {
    setCode(`PUB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`)
    markUnsaved()
  }

  return (
    <main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-5">
      <form
        className="mx-auto max-w-[970px]"
        onSubmit={(event) => {
          event.preventDefault()
          if (readyToSave) setSaved(true)
        }}
      >
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-1.5 text-lg font-semibold"><Tag className="size-4" /><ChevronRight className="size-4 text-black/45" />Create discount</h1>
          <div className="flex items-center gap-2"><Link href="/dashboard/discounts" className="inline-flex h-8 items-center rounded-lg bg-black/[0.06] px-3 text-xs font-medium transition hover:bg-black/10">Discard</Link><button type="submit" disabled={!readyToSave} className="inline-flex h-8 items-center rounded-lg bg-black px-3 text-xs font-semibold text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/15">{saved ? "Saved" : "Save"}</button></div>
        </header>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_312px]">
          <div className="space-y-4">
            <SectionCard>
              <h2 className="text-sm font-semibold">Amount off products</h2>
              <fieldset className="mt-5"><legend className="text-sm font-medium text-black/75">Method</legend><div className="mt-2 inline-flex overflow-hidden rounded-lg border border-black/15"><button type="button" onClick={() => { setMethod("code"); markUnsaved() }} className={`h-8 px-3 text-sm font-medium ${method === "code" ? "bg-black/[0.12]" : "bg-white hover:bg-black/[0.03]"}`}>Discount code</button><button type="button" onClick={() => { setMethod("automatic"); markUnsaved() }} className={`h-8 border-l border-black/15 px-3 text-sm font-medium ${method === "automatic" ? "bg-black/[0.12]" : "bg-white hover:bg-black/[0.03]"}`}>Automatic discount</button></div></fieldset>
              {method === "code" ? <div className="mt-4"><div className="flex items-center justify-between gap-3"><label htmlFor="discount-code" className="text-sm font-medium text-black/75">Discount code</label><button type="button" onClick={generateCode} className="text-sm font-medium text-[#005BD3] hover:underline">Generate random code</button></div><input id="discount-code" value={code} onChange={(event) => { setCode(event.target.value.toUpperCase()); markUnsaved() }} className={`${inputClass} mt-1.5`} /><p className="mt-1.5 text-xs text-black/55">Customers must enter this code at checkout.</p></div> : <p className="mt-4 text-xs text-black/55">Customers will see this discount automatically at checkout.</p>}
            </SectionCard>

            <SectionCard>
              <h2 className="text-sm font-semibold">Discount value</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px]"><Select value={valueType} onValueChange={(nextValue) => { setValueType(nextValue); markUnsaved() }}><SelectTrigger size="sm" className={selectClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percentage">Percentage</SelectItem><SelectItem value="fixed">Fixed amount</SelectItem></SelectContent></Select><div className="relative"><input aria-label="Discount value" inputMode="decimal" value={value} onChange={(event) => { setValue(event.target.value); markUnsaved() }} className={`${inputClass} pr-8`} /><span className="pointer-events-none absolute right-3 top-1.5 text-sm text-black/50">{valueType === "percentage" ? "%" : "₹"}</span></div></div>
              <label className="mt-5 block text-sm font-medium text-black/75">Applies to</label><Select value={appliesTo} onValueChange={(nextValue) => { setAppliesTo(nextValue); markUnsaved() }}><SelectTrigger size="sm" className={`${selectClass} mt-1.5`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="collections">Specific collections</SelectItem><SelectItem value="products">Specific products</SelectItem><SelectItem value="all">All products</SelectItem></SelectContent></Select>
              {appliesTo !== "all" ? <div className="mt-3 flex gap-2"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-2 size-4 text-black/45" /><input aria-label={`Search ${appliesTo}`} value={collectionQuery} onChange={(event) => { setCollectionQuery(event.target.value); markUnsaved() }} placeholder={`Search ${appliesTo}`} className={`${inputClass} pl-9`} /></div><button type="button" onClick={() => setPickerKind(appliesTo as PickerKind)} className="h-8 rounded-lg border border-black/15 px-3 text-sm font-medium hover:bg-black/[0.03]">Browse</button></div> : null}
            </SectionCard>

            <SectionCard><h2 className="text-sm font-semibold">Eligibility</h2><Select value={eligibility} onValueChange={(nextValue) => { setEligibility(nextValue); markUnsaved() }}><SelectTrigger size="sm" className={`${selectClass} mt-4`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All customers</SelectItem><SelectItem value="segments">Specific customer segments</SelectItem><SelectItem value="customers">Specific customers</SelectItem></SelectContent></Select></SectionCard>

            <SectionCard><h2 className="text-sm font-semibold">Minimum purchase requirements</h2><div className="mt-4 space-y-3">{[["none", "No minimum requirements"], ["amount", "Minimum purchase amount (₹)"], ["quantity", "Minimum quantity of items"]].map(([option, label]) => <label key={option} className="flex items-center gap-2 text-sm text-black/75"><input type="radio" name="minimum" value={option} checked={minimum === option} onChange={() => { setMinimum(option); markUnsaved() }} className="size-4 accent-black" />{label}</label>)}</div></SectionCard>

            <SectionCard><h2 className="text-sm font-semibold">Maximum discount uses</h2><div className="mt-4 space-y-3"><label className="flex items-center gap-2 text-sm text-black/75"><input type="checkbox" checked={limitTotal} onChange={(event) => { setLimitTotal(event.target.checked); markUnsaved() }} className="size-4 rounded accent-black" />Limit number of times this discount can be used in total</label><label className="flex items-center gap-2 text-sm text-black/75"><input type="checkbox" checked={limitCustomer} onChange={(event) => { setLimitCustomer(event.target.checked); markUnsaved() }} className="size-4 rounded accent-black" />Limit to one use per customer</label></div></SectionCard>

            <SectionCard><button type="button" onClick={() => setShowCombinations((current) => !current)} className="flex w-full items-center justify-between text-left"><span className="text-sm font-semibold">Combinations</span><CirclePlus className={`size-4 text-black/45 transition ${showCombinations ? "rotate-45" : ""}`} /></button><p className="mt-4 text-sm text-black/65">This discount won&apos;t combine with other product, order, or shipping discounts in the customer&apos;s cart.</p>{showCombinations ? <div className="mt-4 border-t border-black/10 pt-4 text-sm text-black/65">Product, order, and shipping discount combinations can be configured here.</div> : null}</SectionCard>

            <SectionCard><h2 className="text-sm font-semibold">Active dates</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium text-black/75">Start date<div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-2 size-4 text-black/45" /><input type="date" defaultValue="2026-07-21" onChange={markUnsaved} className={`${inputClass} pl-9`} /></div></label><label className="grid gap-1.5 text-sm font-medium text-black/75">Start time (IST)<div className="relative"><Clock3 className="pointer-events-none absolute left-3 top-2 size-4 text-black/45" /><input type="time" defaultValue="13:26" onChange={markUnsaved} className={`${inputClass} pl-9`} /></div></label></div><label className="mt-4 flex items-center gap-2 text-sm text-black/75"><input type="checkbox" onChange={markUnsaved} className="size-4 rounded accent-black" />Set end date</label></SectionCard>
          </div>

          <aside className="space-y-4">
            <SectionCard><h2 className="text-sm font-semibold">{method === "code" && !code ? "No discount code yet" : method === "code" ? code : "Automatic discount"}</h2><div className="mt-1 text-sm text-black/65">{method === "code" ? "Code" : "Automatic"}</div><div className="mt-6 space-y-5 text-sm"><div><h3 className="font-semibold">Type</h3><p className="mt-2 text-black/65">Amount off products</p><p className="mt-1 flex items-center gap-1.5 text-black/65"><Tag className="size-3.5" />Product discount</p></div><div><h3 className="font-semibold">Details</h3><ul className="mt-2 list-disc space-y-1 pl-4 text-black/65"><li>{eligibility === "all" ? "All customers" : "Specific customers"}</li><li>For Online Store</li><li>{minimum === "none" ? "No minimum purchase requirement" : "Minimum purchase required"}</li><li>{limitTotal || limitCustomer ? "Usage limits apply" : "No usage limits"}</li><li>Can&apos;t combine with other discounts</li><li>Active from today</li></ul></div></div></SectionCard>
            <SectionCard><label htmlFor="discount-tags" className="text-sm font-semibold">Tags</label><div className="relative mt-3"><CirclePlus className="pointer-events-none absolute left-3 top-2 size-4 text-black/45" /><input id="discount-tags" value={tags} onChange={(event) => { setTags(event.target.value); markUnsaved() }} placeholder="Add tags" className={`${inputClass} pl-9`} /></div></SectionCard>
          </aside>
        </div>
      </form>
      {pickerKind ? <TargetPickerDialog kind={pickerKind} open={Boolean(pickerKind)} onOpenChange={(open) => { if (!open) setPickerKind(null) }} selectedIds={pickerKind === "collections" ? selectedCollections : selectedProducts} onAdd={(ids) => { if (pickerKind === "collections") { setSelectedCollections(ids); setCollectionQuery(`${ids.length} collection${ids.length === 1 ? "" : "s"} selected`) } else { setSelectedProducts(ids); setCollectionQuery(`${ids.length} product${ids.length === 1 ? "" : "s"} selected`) }; markUnsaved() }} /> : null}
    </main>
  )
}
