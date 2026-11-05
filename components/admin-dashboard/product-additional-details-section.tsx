"use client"

import { useRef, useState } from "react"
import { ListPlus, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toAdminUppercase } from "@/lib/content-case"

type Detail = {
  id: string
  name: string
  value: string
}

export type ProductDetailDraft = Omit<Detail, "id">

export function ProductAdditionalDetailsSection({
  value,
  onChange,
}: {
  value?: ProductDetailDraft[]
  onChange?: (details: ProductDetailDraft[]) => void
}) {
  const [details, setDetails] = useState<Detail[]>(() =>
    (value ?? []).map((detail, index) => ({
      id: `detail-${index}`,
      name: toAdminUppercase(detail.name),
      value: detail.value,
    })),
  )
  const nextDetailId = useRef(1)

  function commit(next: Detail[]) {
    setDetails(next)
    onChange?.(next.map(({ name, value: detailValue }) => ({ name, value: detailValue })))
  }

  function addDetail() {
    const id = `detail-${nextDetailId.current}`
    nextDetailId.current += 1
    commit([...details, { id, name: "", value: "" }])
  }

  function updateDetail(id: string, field: "name" | "value", value: string) {
    // Names are headings (uppercase); the information keeps the case it was typed in.
    const next = field === "name" ? toAdminUppercase(value) : value
    commit(details.map((detail) => detail.id === id ? { ...detail, [field]: next } : detail))
  }

  function removeDetail(id: string) {
    commit(details.filter((detail) => detail.id !== id))
  }

  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 px-4 py-4">
        <div>
          <h2 className="text-sm font-semibold text-black/75">Additional details</h2>
          <p className="mt-1 text-xs leading-5 text-black/50">Short names (Fabric, Rise, Fit) are listed under Features &amp; Care. Names with “&amp;” (e.g. The Fit &amp; Care, Origin &amp; Contact) get their own section on the product page.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addDetail} className="shrink-0 cursor-pointer border-black/15 bg-white text-black/70 shadow-none hover:bg-black/[0.03]">
          <Plus className="size-3.5" /> Add detail
        </Button>
      </div>

      {details.length > 0 ? (
        <div className="border-t border-black/10 px-4 py-4">
          <div className="grid gap-2 text-xs font-medium text-black/50 sm:grid-cols-[minmax(160px,0.8fr)_minmax(0,1.6fr)_32px]">
            <span>Detail name</span>
            <span>Information</span>
          </div>
          <div className="mt-2 space-y-3">
            {details.map((detail) => (
              <div key={detail.id} className="grid items-start gap-2 sm:grid-cols-[minmax(160px,0.8fr)_minmax(0,1.6fr)_32px]">
                <Input
                  aria-label="Detail name"
                  value={detail.name}
                  onChange={(event) => updateDetail(detail.id, "name", event.target.value)}
                  placeholder="e.g. Material"
                  className="border-black/20 bg-white shadow-none focus-visible:border-black/45 focus-visible:ring-black/10"
                />
                <Textarea
                  aria-label={detail.name || "Detail information"}
                  value={detail.value}
                  onChange={(event) => updateDetail(detail.id, "value", event.target.value)}
                  placeholder="Add the product information"
                  className="min-h-9 resize-y border-black/20 bg-white py-2 shadow-none focus-visible:border-black/45 focus-visible:ring-black/10"
                />
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove detail" onClick={() => removeDetail(detail.id)} className="cursor-pointer text-black/40 hover:bg-red-50 hover:text-red-700">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-4 mb-4 flex flex-col items-center rounded-lg border border-dashed border-black/15 bg-black/[0.015] px-4 py-5 text-center">
          <ListPlus className="size-5 text-black/35" />
          <p className="mt-2 text-sm font-medium text-black/65">No additional details yet</p>
          <p className="mt-1 text-xs text-black/45">Use “Add detail” to create your first field.</p>
        </div>
      )}
    </section>
  )
}
