"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, ImageIcon, LayoutTemplate, Loader2, Plus, RotateCcw, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { isVideoMedia } from "@/lib/banner-media"
import { CONTACT_LINE_TYPES, isValidContactLine } from "@/lib/contact-lines"
import { PAGE_DEFS, PAGE_KEYS, resolvePage, type PageDef, type PageKey, type StoredPageContent } from "@/lib/page-content"

import { resetSiteContentAction, saveSiteContentAction } from "@/app/actions/site-content"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { SiteContentAdminView } from "@/lib/server/dal/site-content"
import {
  DEFAULT_SITE_CONTENT,
  policyBlocksToText,
  policyTextToBlocks,
  SITE_CONTENT_LABELS,
  type PolicyContent,
  type SiteContent,
  type SiteContentKey,
} from "@/lib/site-content"

/* ───────────────────────── Shared bits ───────────────────────── */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-black/75">{label}</Label>
      {children}
      {hint ? <p className="text-[11px] text-black/50">{hint}</p> : null}
    </div>
  )
}

function ListControls({
  index,
  count,
  onMove,
  onRemove,
}: {
  index: number
  count: number
  onMove: (from: number, to: number) => void
  onRemove: (index: number) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <Button type="button" variant="outline" size="icon" className="size-7" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label="Move up">
        <ArrowUp className="size-3.5" />
      </Button>
      <Button type="button" variant="outline" size="icon" className="size-7" disabled={index === count - 1} onClick={() => onMove(index, index + 1)} aria-label="Move down">
        <ArrowDown className="size-3.5" />
      </Button>
      <Button type="button" variant="outline" size="icon" className="size-7 text-red-600" onClick={() => onRemove(index)} aria-label="Remove">
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
}

function move<T>(items: T[], from: number, to: number) {
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

async function uploadImage(file: File): Promise<string> {
  const presign = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size, scope: "banner" }),
  })
  if (!presign.ok) {
    const body = (await presign.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? "Upload could not start.")
  }
  const { uploadUrl, publicUrl } = (await presign.json()) as { uploadUrl: string; publicUrl: string }
  const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file })
  if (!put.ok) throw new Error("The image could not be uploaded.")
  return publicUrl
}

function ImageField({
  value,
  onChange,
  label = "Image",
  allowVideo = false,
}: {
  value: string
  onChange: (value: string) => void
  label?: string
  /** Also accept MP4 / WebM (up to 50 MB). */
  allowVideo?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setUploading(true)
    try {
      onChange(await uploadImage(file))
      toast.success("Image uploaded.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <Field
      label={label}
      hint={allowVideo ? "Paste a path or URL, or upload a JPG, PNG, WebP, AVIF, MP4 or WebM (video up to 50 MB)." : "Paste a path or URL, or upload a JPG, PNG, WebP or AVIF."}
    >
      <div className="flex items-center gap-2">
        <div className="size-12 shrink-0 overflow-hidden rounded-md border border-black/10 bg-black/[0.03]">
          {value && isVideoMedia(value) ? (
            <video src={value} muted playsInline preload="metadata" className="size-full object-cover" />
          ) : value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="size-full object-cover" />
          ) : (
            <ImageIcon className="m-3 size-6 text-black/30" />
          )}
        </div>
        <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="/images/products/product1.png" />
        <input ref={inputRef} type="file" accept={allowVideo ? "image/png,image/jpeg,image/webp,image/avif,video/mp4,video/webm" : "image/png,image/jpeg,image/webp,image/avif"} className="hidden" onChange={pick} />
        <Button type="button" variant="outline" className="h-9 shrink-0" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          Upload
        </Button>
      </div>
    </Field>
  )
}

/* ───────────────────────── Section editors ───────────────────────── */

type SectionProps<K extends SiteContentKey> = {
  value: SiteContent[K]
  onChange: (value: SiteContent[K]) => void
}

function AnnouncementsEditor({ value, onChange }: SectionProps<"announcements">) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Field label="Desktop · left"><Input value={value.left} onChange={(e) => onChange({ ...value, left: e.target.value })} /></Field>
      <Field label="Desktop · centre"><Input value={value.center} onChange={(e) => onChange({ ...value, center: e.target.value })} /></Field>
      <Field label="Desktop · right"><Input value={value.right} onChange={(e) => onChange({ ...value, right: e.target.value })} /></Field>
      <div className="md:col-span-3">
        <Field label="Mobile messages (rotate every few seconds)" hint="One per line.">
          <Textarea rows={4} value={value.mobile.join("\n")} onChange={(e) => onChange({ ...value, mobile: e.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })} />
        </Field>
      </div>
    </div>
  )
}

type NavLinkList = SiteContent["navigation"]["edits"]

function NavLinksEditor({ title, items, onChange }: { title: string; items: NavLinkList; onChange: (items: NavLinkList) => void }) {
  return (
    <div className="space-y-2 rounded-lg border border-black/10 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-black/70">{title}</p>
      {items.map((item, index) => (
        <div key={index} className="grid items-end gap-2 md:grid-cols-[1fr_1fr_auto]">
          <Field label="Label"><Input value={item.label} onChange={(e) => onChange(items.map((it, j) => (j === index ? { ...it, label: e.target.value } : it)))} /></Field>
          <Field label="Link"><Input value={item.href} placeholder="/collections/originals" onChange={(e) => onChange(items.map((it, j) => (j === index ? { ...it, href: e.target.value } : it)))} /></Field>
          <ListControls index={index} count={items.length} onMove={(from, to) => onChange(move(items, from, to))} onRemove={(i) => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, { label: "", href: "/collections" }])}>
        <Plus className="size-3.5" /> Add link
      </Button>
    </div>
  )
}

function NavigationEditor({ value, onChange }: SectionProps<"navigation">) {
  const cards = value.cards
  const setCards = (next: typeof cards) => onChange({ ...value, cards: next })
  return (
    <div className="space-y-4">
      <p className="text-xs text-black/55">
        Controls the header mega menus (desktop) and the mobile menu. &ldquo;Collections&rdquo; links to /collections and opens the Edits menu; &ldquo;Men&rdquo; links to /shop and opens the three-column menu.
      </p>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-black/70">Collections menu</p>
        <div className="grid gap-4 lg:grid-cols-3">
          <NavLinksEditor title="Edits" items={value.edits} onChange={(edits) => onChange({ ...value, edits })} />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-black/70">Men menu</p>
        <div className="grid gap-4 lg:grid-cols-3">
          <NavLinksEditor title="Collection" items={value.menCollections} onChange={(menCollections) => onChange({ ...value, menCollections })} />
          <NavLinksEditor title="Categories" items={value.categories} onChange={(categories) => onChange({ ...value, categories })} />
          <NavLinksEditor title="Featured" items={value.menFeatured} onChange={(menFeatured) => onChange({ ...value, menFeatured })} />
        </div>
      </div>
      <Field label="First menu name" hint='Name of the first top-level menu item (the one with the Edits dropdown), e.g. "Collections".'>
        <Input value={value.collectionsLabel} onChange={(e) => onChange({ ...value, collectionsLabel: e.target.value })} />
      </Field>
      <Field label="Bestsellers button link" hint="Bestsellers is a plain button (no dropdown).">
        <Input value={value.bestsellersHref} onChange={(e) => onChange({ ...value, bestsellersHref: e.target.value })} />
      </Field>
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-black/70">Menu images (landscape, up to 3)</p>
        <p className="text-[11px] text-black/50">Recommended size: 1200 × 800 px (3:2, landscape). Text is centred on the image. Collections menu: image 1 on the left, images 2–3 on the right. Men menu: images 2–3 on the right.</p>
        {cards.map((card, index) => (
          <div key={index} className="rounded-lg border border-black/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-black/60">Image {index + 1}</p>
              <ListControls index={index} count={cards.length} onMove={(from, to) => setCards(move(cards, from, to))} onRemove={(i) => setCards(cards.filter((_, j) => j !== i))} />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <ImageField value={card.image} onChange={(image) => setCards(cards.map((c, j) => (j === index ? { ...c, image } : c)))} />
              <Field label="Alt text"><Input value={card.alt} onChange={(e) => setCards(cards.map((c, j) => (j === index ? { ...c, alt: e.target.value } : c)))} /></Field>
              <Field label="Small heading" hint='e.g. "New Launch"'><Input value={card.eyebrow} onChange={(e) => setCards(cards.map((c, j) => (j === index ? { ...c, eyebrow: e.target.value } : c)))} /></Field>
              <Field label="Title"><Input value={card.title} onChange={(e) => setCards(cards.map((c, j) => (j === index ? { ...c, title: e.target.value } : c)))} /></Field>
              <Field label="Link"><Input value={card.href} onChange={(e) => setCards(cards.map((c, j) => (j === index ? { ...c, href: e.target.value } : c)))} /></Field>
            </div>
          </div>
        ))}
        {cards.length < 3 ? (
          <Button type="button" variant="outline" onClick={() => setCards([...cards, { image: "", alt: "", eyebrow: "", title: "", href: "/collections" }])}>
            <Plus className="size-3.5" /> Add image
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function LaunchOfferEditor({ value, onChange }: SectionProps<"launchOffer">) {
  const local = value.endsAt ? new Date(value.endsAt) : null
  const localValue = local && !Number.isNaN(local.getTime())
    ? `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}T${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`
    : ""
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex items-center gap-3 md:col-span-2">
        <Switch checked={value.enabled} onCheckedChange={(enabled) => onChange({ ...value, enabled })} id="launch-enabled" />
        <Label htmlFor="launch-enabled" className="text-sm">Show the launch offer bar on the homepage</Label>
      </div>
      <Field label="Label"><Input value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} /></Field>
      <Field label="Countdown ends at" hint="Local time on this computer.">
        <Input type="datetime-local" value={localValue} onChange={(e) => onChange({ ...value, endsAt: e.target.value ? new Date(e.target.value).toISOString() : value.endsAt })} />
      </Field>
      <Field label="Button text"><Input value={value.ctaText} onChange={(e) => onChange({ ...value, ctaText: e.target.value })} /></Field>
      <Field label="Button link"><Input value={value.ctaHref} onChange={(e) => onChange({ ...value, ctaHref: e.target.value })} /></Field>
    </div>
  )
}

function LookbookEditor({ value, onChange }: SectionProps<"lookbook">) {
  const slides = value.slides
  const set = (next: typeof slides) => onChange({ slides: next })
  return (
    <div className="space-y-3">
      {slides.map((slide, index) => (
        <div key={slide.id} className="rounded-lg border border-black/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-black/60">Slide {index + 1}</p>
            <ListControls index={index} count={slides.length} onMove={(from, to) => set(move(slides, from, to))} onRemove={(i) => set(slides.filter((_, j) => j !== i))} />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_160px]">
            <ImageField label="Image or video" allowVideo value={slide.image} onChange={(image) => set(slides.map((s, j) => (j === index ? { ...s, image } : s)))} />
            <Field label="Alt text"><Input value={slide.alt} onChange={(e) => set(slides.map((s, j) => (j === index ? { ...s, alt: e.target.value } : s)))} /></Field>
            <Field label="Focus (object-position)" hint='e.g. "center 20%"'><Input value={slide.objectPosition} onChange={(e) => set(slides.map((s, j) => (j === index ? { ...s, objectPosition: e.target.value } : s)))} /></Field>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={() => set([...slides, { id: `lookbook-${Date.now()}`, image: "", alt: "", objectPosition: "center" }])}>
        <Plus className="size-3.5" /> Add slide
      </Button>
    </div>
  )
}

function EditsEditor({ value, onChange }: SectionProps<"edits">) {
  const slides = value.slides
  const setSlides = (next: typeof slides) => onChange({ ...value, slides: next })
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Heading"><Input value={value.heading} onChange={(e) => onChange({ ...value, heading: e.target.value })} /></Field>
        <Field label="Tabs" hint="Comma separated. Prefix the active one with *, e.g. ALL, WOMEN, *MEN">
          <Input
            value={value.tabs.map((tab) => `${tab.active ? "*" : ""}${tab.label}`).join(", ")}
            onChange={(e) =>
              onChange({
                ...value,
                tabs: e.target.value
                  .split(",")
                  .map((part) => part.trim())
                  .filter(Boolean)
                  .map((part) => ({ label: part.replace(/^\*/, ""), active: part.startsWith("*") })),
              })
            }
          />
        </Field>
      </div>
      {slides.map((slide, index) => (
        <div key={slide.id} className="rounded-lg border border-black/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-black/60">Card {index + 1}</p>
            <ListControls index={index} count={slides.length} onMove={(from, to) => setSlides(move(slides, from, to))} onRemove={(i) => setSlides(slides.filter((_, j) => j !== i))} />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <ImageField value={slide.image} onChange={(image) => setSlides(slides.map((s, j) => (j === index ? { ...s, image } : s)))} />
            <Field label="Alt text"><Input value={slide.alt} onChange={(e) => setSlides(slides.map((s, j) => (j === index ? { ...s, alt: e.target.value } : s)))} /></Field>
            <Field label="Caption"><Input value={slide.label} onChange={(e) => setSlides(slides.map((s, j) => (j === index ? { ...s, label: e.target.value } : s)))} /></Field>
            <Field label="Link (optional)" hint="e.g. /collections/denim"><Input value={slide.href} onChange={(e) => setSlides(slides.map((s, j) => (j === index ? { ...s, href: e.target.value } : s)))} /></Field>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={() => setSlides([...slides, { id: `edit-${Date.now()}`, image: "", alt: "", label: "Edit Name", href: "" }])}>
        <Plus className="size-3.5" /> Add card
      </Button>
    </div>
  )
}

function ContactEditor({ value, onChange }: SectionProps<"contact">) {
  const faqs = value.faqs
  const setFaqs = (next: typeof faqs) => onChange({ ...value, faqs: next })
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Eyebrow"><Input value={value.eyebrow} onChange={(e) => onChange({ ...value, eyebrow: e.target.value })} /></Field>
        <Field label="Headline" hint="One line per row."><Input value={value.titleLines.join(" / ")} onChange={(e) => onChange({ ...value, titleLines: e.target.value.split("/").map((s) => s.trim()).filter(Boolean) })} /></Field>
        <div className="md:col-span-2">
          <Field label="Description"><Textarea rows={2} value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} /></Field>
        </div>
        <Field label="Phone"><Input value={value.phone} onChange={(e) => onChange({ ...value, phone: e.target.value })} /></Field>
        <Field label="Phone hours"><Input value={value.phoneHours} onChange={(e) => onChange({ ...value, phoneHours: e.target.value })} /></Field>
        <Field label="Email"><Input value={value.email} onChange={(e) => onChange({ ...value, email: e.target.value })} /></Field>
        <Field label="Email response time"><Input value={value.emailResponse} onChange={(e) => onChange({ ...value, emailResponse: e.target.value })} /></Field>
        <Field label="Live chat label"><Input value={value.chatLabel} onChange={(e) => onChange({ ...value, chatLabel: e.target.value })} /></Field>
        <Field label="Live chat hours"><Input value={value.chatHours} onChange={(e) => onChange({ ...value, chatHours: e.target.value })} /></Field>
      </div>
      <div>
        <p className="text-sm font-medium">Frequently asked questions</p>
        <div className="mt-2 space-y-3">
          {faqs.map((faq, index) => (
            <div key={index} className="rounded-lg border border-black/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-black/60">Question {index + 1}</p>
                <ListControls index={index} count={faqs.length} onMove={(from, to) => setFaqs(move(faqs, from, to))} onRemove={(i) => setFaqs(faqs.filter((_, j) => j !== i))} />
              </div>
              <div className="mt-3 space-y-3">
                <Input value={faq.question} placeholder="Question" onChange={(e) => setFaqs(faqs.map((f, j) => (j === index ? { ...f, question: e.target.value } : f)))} />
                <Textarea rows={3} value={faq.answer} placeholder="Answer" onChange={(e) => setFaqs(faqs.map((f, j) => (j === index ? { ...f, answer: e.target.value } : f)))} />
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={() => setFaqs([...faqs, { question: "", answer: "" }])}>
            <Plus className="size-3.5" /> Add question
          </Button>
        </div>
      </div>
    </div>
  )
}

function FooterEditor({ value, onChange }: SectionProps<"footer">) {
  const groups = value.contactGroups
  const setGroups = (next: typeof groups) => onChange({ ...value, contactGroups: next })
  const setGroup = (index: number, patch: Partial<(typeof groups)[number]>) =>
    setGroups(groups.map((g, i) => (i === index ? { ...g, ...patch } : g)))
  const selectClass =
    "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"

  return (
    <div className="space-y-4">
      <p className="text-xs text-black/55">
        Contact details, shown in the product page&apos;s &ldquo;Origin &amp; Contact&rdquo;. Add as many
        groups and lines as you need. Emails, phone and WhatsApp numbers become clickable; the label is optional
        (e.g. &ldquo;Customer Care&rdquo; shows as &ldquo;Customer Care: +91…&rdquo;).
      </p>
      {groups.map((group, index) => (
        <div key={index} className="rounded-lg border border-black/10 p-3">
          <div className="flex items-end justify-between gap-2">
            <Field label="Group heading">
              <Input
                value={group.heading}
                placeholder="For customer care"
                onChange={(e) => setGroup(index, { heading: e.target.value })}
              />
            </Field>
            <ListControls
              index={index}
              count={groups.length}
              onMove={(from, to) => setGroups(move(groups, from, to))}
              onRemove={(i) => setGroups(groups.filter((_, j) => j !== i))}
            />
          </div>

          <div className="mt-3 space-y-2">
            {group.lines.map((line, lineIndex) => {
              const setLine = (patch: Partial<typeof line>) =>
                setGroup(index, { lines: group.lines.map((l, k) => (k === lineIndex ? { ...l, ...patch } : l)) })
              return (
                <div key={lineIndex} className="grid items-center gap-2 sm:grid-cols-[120px_minmax(0,0.8fr)_minmax(0,1.4fr)_auto]">
                  <select
                    aria-label="Line type"
                    className={selectClass}
                    value={line.type}
                    onChange={(e) => setLine({ type: e.target.value as typeof line.type })}
                  >
                    {CONTACT_LINE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <Input
                    aria-label="Label (optional)"
                    placeholder="Label (optional)"
                    value={line.label}
                    onChange={(e) => setLine({ label: e.target.value })}
                  />
                  <Input
                    aria-label="Value"
                    placeholder={
                      line.type === "email" ? "support@pubesto.com" : line.type === "text" ? "Mon-Sat : 9AM - 8PM" : "+91 72680 18889"
                    }
                    value={line.value}
                    aria-invalid={line.value.trim() !== "" && !isValidContactLine(line)}
                    onChange={(e) => setLine({ value: e.target.value })}
                  />
                  <ListControls
                    index={lineIndex}
                    count={group.lines.length}
                    onMove={(from, to) => setGroup(index, { lines: move(group.lines, from, to) })}
                    onRemove={(k) => setGroup(index, { lines: group.lines.filter((_, m) => m !== k) })}
                  />
                </div>
              )
            })}
            <div className="flex flex-wrap gap-2 pt-1">
              {CONTACT_LINE_TYPES.map((t) => (
                <Button
                  key={t.value}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setGroup(index, { lines: [...group.lines, { type: t.value, label: "", value: "" }] })}
                >
                  <Plus className="size-3.5" /> {t.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => setGroups([...groups, { heading: "", lines: [{ type: "text", label: "", value: "" }] }])}
      >
        <Plus className="size-3.5" /> Add group
      </Button>

      <div className="space-y-3 border-t border-black/10 pt-4">
        <p className="text-sm font-semibold text-black/80">Footer columns</p>
        <p className="text-xs text-black/55">
          The link columns at the bottom of every page. A link with an empty URL is hidden, so you can keep e.g. Pinterest ready without showing it yet. Use full addresses (https://…) for social links.
        </p>
        <div className="grid gap-4 lg:grid-cols-3">
          {value.columns.map((column, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-end gap-2">
                <Field label="Column title">
                  <Input
                    value={column.title}
                    onChange={(e) => onChange({ ...value, columns: value.columns.map((c, j) => (j === index ? { ...c, title: e.target.value } : c)) })}
                  />
                </Field>
                <ListControls
                  index={index}
                  count={value.columns.length}
                  onMove={(from, to) => onChange({ ...value, columns: move(value.columns, from, to) })}
                  onRemove={(i) => onChange({ ...value, columns: value.columns.filter((_, j) => j !== i) })}
                />
              </div>
              <NavLinksEditor
                title="Links"
                items={column.links}
                onChange={(links) => onChange({ ...value, columns: value.columns.map((c, j) => (j === index ? { ...c, links } : c)) })}
              />
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" onClick={() => onChange({ ...value, columns: [...value.columns, { title: "", links: [] }] })}>
          <Plus className="size-3.5" /> Add column
        </Button>
      </div>

      <div className="grid gap-4 border-t border-black/10 pt-4 md:grid-cols-3">
        <Field label="Newsletter heading"><Input value={value.newsletterHeading} onChange={(e) => onChange({ ...value, newsletterHeading: e.target.value })} /></Field>
        <Field label="Email field placeholder"><Input value={value.newsletterPlaceholder} onChange={(e) => onChange({ ...value, newsletterPlaceholder: e.target.value })} /></Field>
        <Field label="Button text"><Input value={value.newsletterButton} onChange={(e) => onChange({ ...value, newsletterButton: e.target.value })} /></Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Copyright line"><Input value={value.copyright} onChange={(e) => onChange({ ...value, copyright: e.target.value })} /></Field>
        <NavLinksEditor title="Bottom-right links" items={value.legalLinks} onChange={(legalLinks) => onChange({ ...value, legalLinks })} />
      </div>
    </div>
  )
}

/** Generic editor for the pages described in lib/page-content.ts. */
function PageSectionsEditor({
  pageKey,
  value,
  onChange,
}: {
  pageKey: PageKey
  value: StoredPageContent
  onChange: (value: StoredPageContent) => void
}) {
  const def: PageDef = PAGE_DEFS[pageKey]
  const page = resolvePage(pageKey, value)
  const setSection = (sectionId: string, patch: { visible?: boolean; field?: [string, string] }) => {
    const current = value.sections[sectionId] ?? {}
    onChange({
      sections: {
        ...value.sections,
        [sectionId]: {
          ...current,
          ...(patch.visible !== undefined ? { visible: patch.visible } : {}),
          ...(patch.field ? { fields: { ...current.fields, [patch.field[0]]: patch.field[1] } } : {}),
        },
      },
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-black/55">{def.description} Sections switched off are hidden on the site; their text is kept for later.</p>
      {def.sections.map((section) => {
        const visible = page.show(section.id)
        return (
          <div key={section.id} className={`rounded-lg border p-3 ${visible ? "border-black/10" : "border-dashed border-black/15 bg-black/[0.02]"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-black/80">{section.label}</p>
                {section.hint ? <p className="mt-0.5 text-[11px] text-black/50">{section.hint}</p> : null}
              </div>
              {section.hideable ? (
                <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-black/60">
                  <input
                    type="checkbox"
                    className="size-4 accent-black"
                    checked={visible}
                    onChange={(e) => setSection(section.id, { visible: e.target.checked })}
                  />
                  {visible ? "Shown" : "Hidden"}
                </label>
              ) : (
                <span className="shrink-0 text-[11px] text-black/40">Always shown</span>
              )}
            </div>
            {visible && section.fields.length > 0 ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {section.fields.map((field) => {
                  const current = page.text(section.id, field.id)
                  const set = (next: string) => setSection(section.id, { field: [field.id, next] })
                  if (field.kind === "image") {
                    return <ImageField key={field.id} label={field.label} value={current} onChange={set} />
                  }
                  return (
                    <Field key={field.id} label={field.label} hint={field.hint}>
                      {field.kind === "textarea" ? (
                        <Textarea rows={3} value={current} onChange={(e) => set(e.target.value)} />
                      ) : (
                        <Input value={current} onChange={(e) => set(e.target.value)} />
                      )}
                    </Field>
                  )
                })}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function ProductPageSharedEditor({ value, onChange }: SectionProps<"productPage">) {
  const text = (key: "shipping" | "returns" | "exchanges" | "refunds" | "origin", label: string, hint: string) => (
    <Field label={label} hint={hint}>
      <Textarea rows={4} value={value[key]} onChange={(e) => onChange({ ...value, [key]: e.target.value })} />
    </Field>
  )
  return (
    <div className="space-y-4">
      <p className="text-xs text-black/55">
        Shown on every product page. A single product can replace the shipping or origin text in its own edit screen.
      </p>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-black/75">
        <input
          type="checkbox"
          className="size-4 accent-black"
          checked={value.showHighlightStrip}
          onChange={(e) => onChange({ ...value, showHighlightStrip: e.target.checked })}
        />
        Show the highlight strip (4 tiles under the badges) on product pages
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Returns badge" hint="Leave empty to hide. A product can also hide both badges.">
          <Input value={value.returnsBadge} onChange={(e) => onChange({ ...value, returnsBadge: e.target.value })} />
        </Field>
        <Field label="Exchanges badge" hint='e.g. "Easy 30 Days Exchanges" once the policy is confirmed.'>
          <Input value={value.exchangesBadge} onChange={(e) => onChange({ ...value, exchangesBadge: e.target.value })} />
        </Field>
      </div>
      {text("shipping", "Shipping", "One point per line. Shown under “Shipping, Returns & Exchanges”.")}
      {text("returns", "Returns", "One point per line.")}
      {text("exchanges", "Exchanges", "One point per line.")}
      {text("refunds", "Refunds", "One point per line.")}
      {text("origin", "Origin & Contact", "Shown above the footer contact details in “Origin & Contact”.")}
    </div>
  )
}

function ReturnsPageEditor({ value, onChange }: SectionProps<"returnsPage">) {
  return (
    <div className="space-y-4">
      <Field label="Title"><Input value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} /></Field>
      <ImageField label="Side image" value={value.image} onChange={(image) => onChange({ ...value, image })} />
      <Field label="Conditions" hint="One per line.">
        <Textarea rows={6} value={value.conditions.join("\n")} onChange={(e) => onChange({ ...value, conditions: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
      </Field>
    </div>
  )
}

function SizeGuideEditor({ value, onChange }: SectionProps<"sizeGuide">) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Title" hint="The big heading on /size-guide"><Input value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} /></Field>
        <Field label="Subtitle" hint="Optional line under the title; leave empty to hide"><Input value={value.subtitle} onChange={(e) => onChange({ ...value, subtitle: e.target.value })} /></Field>
      </div>
      <Field label="Note under the size table" hint="Shown on /size-guide and in the size chart on product pages">
        <Textarea rows={3} value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })} />
      </Field>
    </div>
  )
}

function PolicyEditor({ value, onChange }: { value: PolicyContent; onChange: (value: PolicyContent) => void }) {
  const sections = value.sections
  const setSections = (next: typeof sections) => onChange({ ...value, sections: next })
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Page title"><Input value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} /></Field>
        <Field label="Browser tab title"><Input value={value.metaTitle} onChange={(e) => onChange({ ...value, metaTitle: e.target.value })} /></Field>
        <Field label="Search description"><Input value={value.metaDescription} onChange={(e) => onChange({ ...value, metaDescription: e.target.value })} /></Field>
      </div>
      <Field label="Introduction" hint="Paragraphs separated by a blank line. Links: [text](https://… or mailto:…)">
        <Textarea rows={4} value={value.intro.join("\n\n")} onChange={(e) => onChange({ ...value, intro: e.target.value.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean) })} />
      </Field>
      <div className="space-y-3">
        {sections.map((section, index) => (
          <div key={`${section.id}-${index}`} className="rounded-lg border border-black/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-black/60">Section {index + 1}</p>
              <ListControls index={index} count={sections.length} onMove={(from, to) => setSections(move(sections, from, to))} onRemove={(i) => setSections(sections.filter((_, j) => j !== i))} />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Field label="Heading"><Input value={section.title} onChange={(e) => setSections(sections.map((s, j) => (j === index ? { ...s, title: e.target.value } : s)))} /></Field>
              <Field label="Menu label"><Input value={section.navLabel} onChange={(e) => setSections(sections.map((s, j) => (j === index ? { ...s, navLabel: e.target.value } : s)))} /></Field>
              <Field label="Anchor id" hint="lowercase-with-dashes"><Input value={section.id} onChange={(e) => setSections(sections.map((s, j) => (j === index ? { ...s, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") } : s)))} /></Field>
            </div>
            <div className="mt-3">
              <Field label="Body" hint="Blank line between paragraphs. Start a line with “- ” for a bullet.">
                <Textarea rows={6} value={policyBlocksToText(section.blocks)} onChange={(e) => setSections(sections.map((s, j) => (j === index ? { ...s, blocks: policyTextToBlocks(e.target.value) } : s)))} />
              </Field>
            </div>
            <div className="mt-3 space-y-2">
              {section.subsections.map((sub, subIndex) => (
                <div key={subIndex} className="rounded-md border border-dashed border-black/15 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Input className="h-8 max-w-sm" value={sub.title} placeholder="Sub-heading" onChange={(e) => setSections(sections.map((s, j) => (j === index ? { ...s, subsections: s.subsections.map((x, k) => (k === subIndex ? { ...x, title: e.target.value } : x)) } : s)))} />
                    <Button type="button" variant="outline" size="icon" className="size-7 text-red-600" aria-label="Remove sub-section" onClick={() => setSections(sections.map((s, j) => (j === index ? { ...s, subsections: s.subsections.filter((_, k) => k !== subIndex) } : s)))}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <Textarea className="mt-2" rows={4} value={policyBlocksToText(sub.blocks)} onChange={(e) => setSections(sections.map((s, j) => (j === index ? { ...s, subsections: s.subsections.map((x, k) => (k === subIndex ? { ...x, blocks: policyTextToBlocks(e.target.value) } : x)) } : s)))} />
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setSections(sections.map((s, j) => (j === index ? { ...s, subsections: [...s.subsections, { title: "", blocks: [] }] } : s)))}>
                <Plus className="size-3.5" /> Add sub-section
              </Button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => setSections([...sections, { id: `section-${sections.length + 1}`, title: "", navLabel: "", blocks: [], subsections: [] }])}>
          <Plus className="size-3.5" /> Add section
        </Button>
      </div>
    </div>
  )
}

/* ───────────────────────── Manager ───────────────────────── */

const TAB_GROUPS: Array<{ key: SiteContentKey; title: string }> = [
  { key: "announcements", title: SITE_CONTENT_LABELS.announcements },
  { key: "navigation", title: SITE_CONTENT_LABELS.navigation },
  { key: "launchOffer", title: SITE_CONTENT_LABELS.launchOffer },
  { key: "lookbook", title: SITE_CONTENT_LABELS.lookbook },
  { key: "edits", title: SITE_CONTENT_LABELS.edits },
  { key: "contact", title: SITE_CONTENT_LABELS.contact },
  { key: "footer", title: SITE_CONTENT_LABELS.footer },
  { key: "productPage", title: SITE_CONTENT_LABELS.productPage },
  { key: "returnsPage", title: SITE_CONTENT_LABELS.returnsPage },
  { key: "sizeGuide", title: SITE_CONTENT_LABELS.sizeGuide },
  { key: "privacyPolicy", title: SITE_CONTENT_LABELS.privacyPolicy },
  { key: "termsPolicy", title: SITE_CONTENT_LABELS.termsPolicy },
  { key: "shippingPolicy", title: SITE_CONTENT_LABELS.shippingPolicy },
  ...PAGE_KEYS.map((key) => ({ key, title: SITE_CONTENT_LABELS[key] })),
]

export function ContentManager({ initial }: { initial: SiteContentAdminView }) {
  const router = useRouter()
  const [content, setContent] = useState<SiteContent>(initial.content)
  const [dirty, setDirty] = useState<Set<SiteContentKey>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [active, setActive] = useState<SiteContentKey>("announcements")

  function update<K extends SiteContentKey>(key: K, value: SiteContent[K]) {
    setContent((current) => ({ ...current, [key]: value }))
    setDirty((current) => new Set(current).add(key))
  }

  function save(key: SiteContentKey) {
    startTransition(async () => {
      const result = await saveSiteContentAction({ key, value: content[key] })
      if (!result.success) {
        toast.error(result.message)
        return
      }
      toast.success(`${SITE_CONTENT_LABELS[key]} published.`)
      setDirty((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
      router.refresh()
    })
  }

  function reset(key: SiteContentKey) {
    startTransition(async () => {
      const result = await resetSiteContentAction({ key })
      if (!result.success) {
        toast.error(result.message)
        return
      }
      setContent((current) => ({ ...current, [key]: structuredClone(DEFAULT_SITE_CONTENT[key]) }))
      setDirty((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
      toast.success(`${SITE_CONTENT_LABELS[key]} restored to the original.`)
      router.refresh()
    })
  }

  function renderEditor(key: SiteContentKey) {
    if ((PAGE_KEYS as string[]).includes(key)) {
      const pageKey = key as PageKey
      return <PageSectionsEditor pageKey={pageKey} value={content[pageKey]} onChange={(v) => update(pageKey, v)} />
    }
    switch (key) {
      case "announcements":
        return <AnnouncementsEditor value={content.announcements} onChange={(v) => update("announcements", v)} />
      case "navigation":
        return <NavigationEditor value={content.navigation} onChange={(v) => update("navigation", v)} />
      case "launchOffer":
        return <LaunchOfferEditor value={content.launchOffer} onChange={(v) => update("launchOffer", v)} />
      case "lookbook":
        return <LookbookEditor value={content.lookbook} onChange={(v) => update("lookbook", v)} />
      case "edits":
        return <EditsEditor value={content.edits} onChange={(v) => update("edits", v)} />
      case "contact":
        return <ContactEditor value={content.contact} onChange={(v) => update("contact", v)} />
      case "footer":
        return <FooterEditor value={content.footer} onChange={(v) => update("footer", v)} />
      case "productPage":
        return <ProductPageSharedEditor value={content.productPage} onChange={(v) => update("productPage", v)} />
      case "returnsPage":
        return <ReturnsPageEditor value={content.returnsPage} onChange={(v) => update("returnsPage", v)} />
      case "sizeGuide":
        return <SizeGuideEditor value={content.sizeGuide} onChange={(v) => update("sizeGuide", v)} />
      case "privacyPolicy":
        return <PolicyEditor value={content.privacyPolicy} onChange={(v) => update("privacyPolicy", v)} />
      case "termsPolicy":
        return <PolicyEditor value={content.termsPolicy} onChange={(v) => update("termsPolicy", v)} />
      case "shippingPolicy":
        return <PolicyEditor value={content.shippingPolicy} onChange={(v) => update("shippingPolicy", v)} />
    }
  }

  const override = initial.overrides[active]

  return (
    <main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <LayoutTemplate className="size-4" />
            Website content
            {isPending ? <Loader2 className="size-4 animate-spin text-black/40" /> : null}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-black/60">
            Edit the text, images and policies shown on the storefront. Changes go live as soon as you publish a section.
          </p>
        </div>
      </div>

      <Tabs value={active} onValueChange={(value) => setActive(value as SiteContentKey)} className="mt-4">
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-white p-1 shadow-sm">
          {TAB_GROUPS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="text-xs data-[state=active]:bg-black data-[state=active]:text-white">
              {tab.title}
              {dirty.has(tab.key) ? <span className="ml-1 size-1.5 rounded-full bg-amber-500" /> : null}
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_GROUPS.map((tab) => (
          <TabsContent key={tab.key} value={tab.key} className="mt-4">
            <section className="rounded-xl border border-black/10 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-4">
                <div>
                  <h2 className="text-sm font-semibold">{tab.title}</h2>
                  <p className="text-xs text-black/55">
                    {override
                      ? `Last published ${new Date(override.updatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}${override.updatedBy ? ` by ${override.updatedBy}` : ""}`
                      : "Showing the original built-in content."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" className="h-8 text-xs" disabled={isPending || !override} onClick={() => reset(tab.key)}>
                    <RotateCcw className="size-3.5" />
                    Restore original
                  </Button>
                  <Button type="button" className="h-8 text-xs" disabled={isPending || !dirty.has(tab.key)} onClick={() => save(tab.key)}>
                    Publish changes
                  </Button>
                </div>
              </div>
              <div className="pt-4">{renderEditor(tab.key)}</div>
            </section>
          </TabsContent>
        ))}
      </Tabs>
    </main>
  )
}
