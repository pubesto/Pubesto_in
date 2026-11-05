"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, LoaderCircle, Tag, Truck } from "lucide-react"
import { toast } from "sonner"

import { createDiscountAction, updateDiscountAction } from "@/app/actions/discounts"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { AdminDiscountEditor, AdminDiscountOption } from "@/lib/server/dal/discounts"

type DiscountType = AdminDiscountEditor["type"]
type Method = AdminDiscountEditor["method"]
type ValueType = AdminDiscountEditor["valueType"]
type AppliesTo = AdminDiscountEditor["appliesTo"]
type MinimumType = AdminDiscountEditor["minimumType"]

function inputClass(extra = "") {
  return `h-10 w-full rounded-lg border border-black/20 bg-white px-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 ${extra}`
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function typeTitle(type: DiscountType) {
  if (type === "PRODUCT") return "Amount off products"
  if (type === "ORDER") return "Amount off order"
  if (type === "BUY_X_GET_Y") return "Buy X get Y"
  return "Free shipping"
}

function SelectableList({
  options,
  selectedIds,
  onChange,
  emptyLabel,
}: {
  options: AdminDiscountOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  emptyLabel: string
}) {
  const toggle = (id: string) => onChange(selectedIds.includes(id) ? selectedIds.filter((selectedId) => selectedId !== id) : [...selectedIds, id])

  return (
    <div className="max-h-52 overflow-y-auto rounded-lg border border-black/10">
      {options.length ? options.map((option) => (
        <label key={option.id} className="flex cursor-pointer items-center gap-2 border-b border-black/[0.08] px-3 py-2 text-sm last:border-b-0 hover:bg-black/[0.02]">
          <input type="checkbox" checked={selectedIds.includes(option.id)} onChange={() => toggle(option.id)} className="size-4 accent-black" />
          <span className="min-w-0 truncate">{option.title}</span>
        </label>
      )) : <p className="px-3 py-6 text-center text-xs text-black/55">{emptyLabel}</p>}
    </div>
  )
}

export function DiscountEditor({
  type,
  products,
  collections,
  initial,
}: {
  type: DiscountType
  products: AdminDiscountOption[]
  collections: AdminDiscountOption[]
  initial?: AdminDiscountEditor
}) {
  const router = useRouter()
  const [title, setTitle] = useState(initial?.title ?? "")
  const [method, setMethod] = useState<Method>(initial?.method ?? "CODE")
  const [code, setCode] = useState(initial?.code ?? "")
  const [valueType, setValueType] = useState<ValueType>(type === "FREE_SHIPPING" ? "FREE" : initial?.valueType ?? "PERCENTAGE")
  const [value, setValue] = useState(initial?.value?.toString() ?? "")
  const [appliesTo, setAppliesTo] = useState<AppliesTo>(initial?.appliesTo ?? "ALL")
  const [productIds, setProductIds] = useState(initial?.productIds ?? [])
  const [collectionIds, setCollectionIds] = useState(initial?.collectionIds ?? [])
  const [buyProductIds, setBuyProductIds] = useState(initial?.buyProductIds ?? [])
  const [getProductIds, setGetProductIds] = useState(initial?.getProductIds ?? [])
  const [minimumType, setMinimumType] = useState<MinimumType>(initial?.minimumType ?? "NONE")
  const [minimumValue, setMinimumValue] = useState(initial?.minimumValue?.toString() ?? "")
  const [usageLimit, setUsageLimit] = useState(initial?.usageLimit?.toString() ?? "")
  const [onePerCustomer, setOnePerCustomer] = useState(initial?.onePerCustomer ?? false)
  const [active, setActive] = useState(initial?.status !== "INACTIVE")
  const [startsAt, setStartsAt] = useState(() => initial?.startsAt ? new Date(initial.startsAt) : new Date())
  const [hasEndDate, setHasEndDate] = useState(Boolean(initial?.endsAt))
  const [endsAt, setEndsAt] = useState(() => initial?.endsAt ? new Date(initial.endsAt) : new Date())
  const [isPending, startTransition] = useTransition()

  const isShipping = type === "FREE_SHIPPING"
  const isBuyXGetY = type === "BUY_X_GET_Y"
  const isProduct = type === "PRODUCT"
  const numericValue = Number(value)
  const numericMinimum = Number(minimumValue)
  const numericUsageLimit = Number(usageLimit)
  const canSave = Boolean(title.trim()) && (method === "AUTOMATIC" || code.trim()) && (isShipping || valueType === "FREE" || (Number.isFinite(numericValue) && numericValue > 0))

  const generateCode = () => setCode(`PUB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`)

  const save = () => {
    const payload = {
      title: title.trim(),
      code: method === "CODE" ? code.trim().toUpperCase() : null,
      type,
      method,
      status: active ? "ACTIVE" as const : "INACTIVE" as const,
      valueType: isShipping ? "FREE" as const : valueType,
      value: isShipping || valueType === "FREE" ? null : numericValue,
      appliesTo: isProduct ? appliesTo : "ALL" as const,
      productIds,
      collectionIds,
      buyProductIds,
      getProductIds,
      minimumType,
      minimumValue: minimumType === "NONE" ? null : numericMinimum,
      usageLimit: usageLimit.trim() ? numericUsageLimit : null,
      onePerCustomer,
      startsAt: startsAt.toISOString(),
      endsAt: hasEndDate ? endsAt.toISOString() : null,
    }

    startTransition(async () => {
      const result = initial ? await updateDiscountAction({ id: initial.id, ...payload }) : await createDiscountAction(payload)
      if (!("id" in result)) {
        toast.error(result.message)
        return
      }
      toast.success(initial ? "Discount updated." : "Discount created.")
      router.replace("/dashboard/discounts")
      router.refresh()
    })
  }

  return (
    <main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-5">
      <form className="w-full" onSubmit={(event) => { event.preventDefault(); save() }}>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/dashboard/discounts" className="text-xs font-medium text-black/55 transition hover:text-black hover:underline">Discounts</Link>
            <h1 className="mt-1 flex items-center gap-1.5 text-lg font-semibold">
              {isShipping ? <Truck className="size-4" /> : <Tag className="size-4" />}<ChevronRight className="size-4 text-black/45" />
              {initial ? "Edit discount" : "Create discount"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/discounts" className="inline-flex h-9 items-center rounded-lg bg-black/[0.06] px-3 text-sm font-medium transition hover:bg-black/10">Discard</Link>
            <button type="submit" disabled={!canSave || isPending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-black px-3 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/30">
              {isPending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}{initial ? "Save changes" : "Create discount"}
            </button>
          </div>
        </header>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <Card title={typeTitle(type)}>
              <label className="grid gap-1.5 text-sm font-medium">Discount title
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={method === "CODE" ? "SUMMER10" : "Summer collection offer"} className={inputClass()} required />
              </label>
              <fieldset className="mt-5">
                <legend className="text-sm font-medium">Method</legend>
                <div className="mt-2 inline-flex overflow-hidden rounded-lg border border-black/15">
                  <button type="button" onClick={() => setMethod("CODE")} className={`h-9 px-3 text-sm font-medium ${method === "CODE" ? "bg-black/[0.11]" : "hover:bg-black/[0.03]"}`}>Discount code</button>
                  <button type="button" onClick={() => setMethod("AUTOMATIC")} className={`h-9 border-l border-black/15 px-3 text-sm font-medium ${method === "AUTOMATIC" ? "bg-black/[0.11]" : "hover:bg-black/[0.03]"}`}>Automatic</button>
                </div>
              </fieldset>
              {method === "CODE" ? (
                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3"><label htmlFor="discount-code" className="text-sm font-medium">Discount code</label><button type="button" onClick={generateCode} className="text-xs font-semibold text-[#0c3152] hover:underline">Generate code</button></div>
                  <input id="discount-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="SUMMER10" className={`${inputClass()} mt-1.5 font-mono`} required />
                  <p className="mt-1.5 text-xs text-black/55">Customers enter this exact code at checkout.</p>
                </div>
              ) : <p className="mt-4 text-xs text-black/55">Eligible carts receive this offer automatically.</p>}
            </Card>

            {!isShipping ? <Card title="Discount value">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                <Select value={valueType} onValueChange={(nextValue) => setValueType(nextValue as ValueType)}>
                  <SelectTrigger className={inputClass()}><SelectValue /></SelectTrigger>
                  <SelectContent position="popper"><SelectItem value="PERCENTAGE">Percentage</SelectItem><SelectItem value="FIXED">Fixed amount</SelectItem>{isBuyXGetY ? <SelectItem value="FREE">Free</SelectItem> : null}</SelectContent>
                </Select>
                {valueType === "FREE" ? <div className="flex h-10 items-center rounded-lg border border-black/10 bg-black/[0.03] px-3 text-sm text-black/60">No value required</div> : <label className="relative"><span className="sr-only">Discount value</span><input value={value} onChange={(event) => setValue(event.target.value)} inputMode="decimal" placeholder="0" className={`${inputClass()} pr-8`} required /><span className="pointer-events-none absolute right-3 top-2.5 text-sm text-black/50">{valueType === "PERCENTAGE" ? "%" : "₹"}</span></label>}
              </div>
              <p className="mt-2 text-xs text-black/55">{valueType === "PERCENTAGE" ? "Percentage discounts can be up to 100%." : "The exact value is validated before it is saved."}</p>
            </Card> : null}

            {isProduct ? <Card title="Applies to">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm"><input type="radio" checked={appliesTo === "ALL"} onChange={() => setAppliesTo("ALL")} className="size-4 accent-black" />All products</label>
                <label className="flex items-center gap-2 text-sm"><input type="radio" checked={appliesTo === "PRODUCTS"} onChange={() => setAppliesTo("PRODUCTS")} className="size-4 accent-black" />Specific products</label>
                {appliesTo === "PRODUCTS" ? <SelectableList options={products} selectedIds={productIds} onChange={setProductIds} emptyLabel="No products are available." /> : null}
                <label className="flex items-center gap-2 text-sm"><input type="radio" checked={appliesTo === "COLLECTIONS"} onChange={() => setAppliesTo("COLLECTIONS")} className="size-4 accent-black" />Specific collections</label>
                {appliesTo === "COLLECTIONS" ? <SelectableList options={collections} selectedIds={collectionIds} onChange={setCollectionIds} emptyLabel="No collections are available." /> : null}
              </div>
            </Card> : null}

            {isBuyXGetY ? <Card title="Products"><div className="grid gap-4 lg:grid-cols-2"><div><h3 className="text-sm font-medium">Customer buys</h3><p className="mt-1 text-xs text-black/55">Select the qualifying products.</p><div className="mt-3"><SelectableList options={products} selectedIds={buyProductIds} onChange={setBuyProductIds} emptyLabel="No products are available." /></div></div><div><h3 className="text-sm font-medium">Customer gets</h3><p className="mt-1 text-xs text-black/55">Select the discounted products.</p><div className="mt-3"><SelectableList options={products} selectedIds={getProductIds} onChange={setGetProductIds} emptyLabel="No products are available." /></div></div></div></Card> : null}

            <Card title="Minimum purchase requirements">
              <div className="grid gap-3 sm:grid-cols-[190px_minmax(0,1fr)]">
                <Select value={minimumType} onValueChange={(nextValue) => setMinimumType(nextValue as MinimumType)}>
                  <SelectTrigger className={inputClass()}><SelectValue /></SelectTrigger>
                  <SelectContent position="popper"><SelectItem value="NONE">No minimum</SelectItem><SelectItem value="AMOUNT">Minimum order amount</SelectItem><SelectItem value="QUANTITY">Minimum item quantity</SelectItem></SelectContent>
                </Select>
                {minimumType === "NONE" ? <div className="flex h-10 items-center text-sm text-black/55">This offer has no minimum requirement.</div> : <label className="relative"><span className="sr-only">Minimum value</span><input value={minimumValue} onChange={(event) => setMinimumValue(event.target.value)} inputMode="decimal" placeholder="0" className={inputClass(minimumType === "AMOUNT" ? "pr-8" : "")} required /><span className="pointer-events-none absolute right-3 top-2.5 text-sm text-black/50">{minimumType === "AMOUNT" ? "₹" : "items"}</span></label>}
              </div>
            </Card>

            <Card title="Usage limits">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(usageLimit)} onChange={(event) => { if (!event.target.checked) setUsageLimit(""); else if (!usageLimit) setUsageLimit("1") }} className="size-4 rounded accent-black" />Limit total uses</label>
              {usageLimit ? <label className="mt-3 grid gap-1.5 text-sm font-medium">Maximum uses<input value={usageLimit} onChange={(event) => setUsageLimit(event.target.value)} inputMode="numeric" className={inputClass()} /></label> : null}
              <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={onePerCustomer} onChange={(event) => setOnePerCustomer(event.target.checked)} className="size-4 rounded accent-black" />Limit to one use per customer</label>
            </Card>

            <Card title="Active dates">
              <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium">Start date and time<DateTimePicker value={startsAt} onChange={setStartsAt} /></label><label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={hasEndDate} onChange={(event) => setHasEndDate(event.target.checked)} className="size-4 rounded accent-black" />Set end date</label></div>
              {hasEndDate ? <label className="mt-3 grid max-w-sm gap-1.5 text-sm font-medium">End date and time<DateTimePicker value={endsAt} onChange={setEndsAt} /></label> : null}
            </Card>
          </div>

          <aside className="space-y-4">
            <Card title="Discount summary"><div className="space-y-4 text-sm"><div><p className="font-semibold">{title || "Untitled discount"}</p><p className="mt-1 text-black/60">{method === "CODE" ? code || "No code yet" : "Automatic discount"}</p></div><div className="border-t border-black/10 pt-4"><p className="font-medium">Type</p><p className="mt-1 text-black/60">{typeTitle(type)}</p></div><div className="border-t border-black/10 pt-4"><p className="font-medium">Availability</p><label className="mt-2 flex items-center justify-between gap-3"><span className="text-black/60">Active</span><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="size-4 accent-black" /></label></div><div className="border-t border-black/10 pt-4"><p className="font-medium">Eligibility</p><p className="mt-1 text-black/60">All customers</p></div></div></Card>
            <Card title="Before you save"><p className="text-xs leading-5 text-black/60">Discounts are validated for unique codes, eligible catalog targets, values, dates, and usage limits before they are stored.</p></Card>
          </aside>
        </div>
      </form>
    </main>
  )
}
