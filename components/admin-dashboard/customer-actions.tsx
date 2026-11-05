"use client"

import * as React from "react"
import { countries } from "country-flag-icons"
import * as CountryFlags from "country-flag-icons/react/3x2"
import { State } from "country-state-city"
import {
  ChevronDown,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Search,
  Smartphone,
  X,
} from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

type ModalName = "customer" | "address" | "marketing" | null

const inputClass = "h-8 w-full rounded-lg border border-black/30 bg-white px-3 text-sm outline-none transition focus:border-black/60 focus:ring-2 focus:ring-black/5"

type CountryFlag = React.ComponentType<React.SVGProps<SVGSVGElement>>

type CountryOption = {
  code: string
  name: string
}

const COUNTRY_FLAG_COMPONENTS = CountryFlags as unknown as Record<string, CountryFlag>
const COUNTRY_NAME_OVERRIDES: Record<string, string> = {
  AC: "Ascension Island",
  BQ: "Caribbean Netherlands",
  "BQ-BO": "Bonaire",
  "BQ-SA": "Saba",
  "BQ-SE": "Sint Eustatius",
  "ES-CT": "Catalonia",
  EU: "European Union",
  "GB-ENG": "England",
  "GB-NIR": "Northern Ireland",
  "GB-SCT": "Scotland",
  "GB-WLS": "Wales",
  IC: "Canary Islands",
  TA: "Tristan da Cunha",
  XA: "Abkhazia",
  XC: "Northern Cyprus",
  XK: "Kosovo",
  XO: "South Ossetia",
}
const regionNames = new Intl.DisplayNames(["en"], { type: "region" })

function getCountryName(code: string) {
  if (COUNTRY_NAME_OVERRIDES[code]) return COUNTRY_NAME_OVERRIDES[code]

  try {
    return regionNames.of(code) ?? code
  } catch {
    return code
  }
}

const COUNTRY_OPTIONS: CountryOption[] = countries
  .map((code) => ({
    code,
    name: getCountryName(code),
  }))
  .sort((first, second) => first.name.localeCompare(second.name))

function CountryFlagIcon({ code, className }: { code: string; className?: string }) {
  const Flag = COUNTRY_FLAG_COMPONENTS[code.replaceAll("-", "_")]

  return Flag ? <Flag aria-hidden="true" className={className} /> : <span className={className}>{code}</span>
}

function CountrySelect({
  compact = false,
  countryCode: controlledCountryCode,
  onCountryChange,
}: {
  compact?: boolean
  countryCode?: string
  onCountryChange?: (countryCode: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [uncontrolledCountryCode, setUncontrolledCountryCode] = React.useState("IN")
  const countryCode = controlledCountryCode ?? uncontrolledCountryCode
  const selectedCountry = COUNTRY_OPTIONS.find((country) => country.code === countryCode) ?? COUNTRY_OPTIONS[0]
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleCountries = normalizedQuery
    ? COUNTRY_OPTIONS.filter((country) => `${country.name} ${country.code}`.toLocaleLowerCase().includes(normalizedQuery))
    : COUNTRY_OPTIONS
  const popoverWidthClass = compact
    ? "!w-[min(30rem,calc(100vw-1rem))] !max-w-[calc(100vw-1rem)]"
    : "!w-[calc(100vw-1rem)] !max-w-[calc(100vw-1rem)] sm:!w-[var(--radix-popover-trigger-width)] sm:!max-w-none"

  const selectCountry = (code: string) => {
    if (!controlledCountryCode) setUncontrolledCountryCode(code)
    onCountryChange?.(code)
    setQuery("")
    setOpen(false)
  }

  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild>{compact ? <button type="button" aria-label={`Phone country: ${selectedCountry.name}`} className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-black/30 px-2 transition hover:bg-black/[0.03]"><CountryFlagIcon code={selectedCountry.code} className="h-3.5 w-[21px] rounded-[1px] object-cover" /><ChevronDown className="size-3.5 text-black/55" /></button> : <button type="button" aria-label={`Country or region: ${selectedCountry.name}`} className={`${inputClass} flex items-center gap-2 text-left hover:bg-black/[0.015]`}><CountryFlagIcon code={selectedCountry.code} className="h-3.5 w-[21px] rounded-[1px] object-cover" /><span className="min-w-0 flex-1 truncate">{selectedCountry.name}</span><ChevronDown className="size-4 shrink-0 text-black/45" /></button>}</PopoverTrigger><PopoverContent align="start" sideOffset={6} className={`${popoverWidthClass} rounded-xl p-2 shadow-lg`}><label className="sr-only" htmlFor={`country-search-${compact ? "phone" : "address"}`}>Search countries</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-black/45" /><input id={`country-search-${compact ? "phone" : "address"}`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search countries" autoComplete="off" className={`${inputClass} pl-9`} /></div><ScrollArea role="listbox" aria-label="Countries" onWheelCapture={(event) => event.stopPropagation()} onTouchMoveCapture={(event) => event.stopPropagation()} className="mt-2 h-64">{visibleCountries.length ? <div className="pr-4">{visibleCountries.map((country) => <button key={country.code} type="button" role="option" aria-selected={country.code === countryCode} onClick={() => selectCountry(country.code)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-sm transition hover:bg-black/[0.05] aria-selected:bg-black/[0.06]"><CountryFlagIcon code={country.code} className="h-3.5 w-[21px] shrink-0 rounded-[1px] object-cover" /><span className="min-w-0 flex-1 truncate">{country.name}</span><span className="ml-auto shrink-0 text-xs text-black/45">{country.code}</span></button>)}</div> : <p className="px-2 py-5 text-center text-sm text-black/55">No countries found</p>}</ScrollArea></PopoverContent></Popover>
}

function ModalHeading({ title, onClose }: { title: string; onClose: () => void }) {
  return <DialogHeader className="flex-row items-center justify-between border-b border-black/10 px-4 py-4"><div><DialogTitle className="text-sm font-semibold">{title}</DialogTitle><DialogDescription className="sr-only">{title} form</DialogDescription></div><button type="button" onClick={onClose} aria-label={`Close ${title}`} className="rounded-md p-1 text-black/45 transition hover:bg-black/5 hover:text-black"><X className="size-5" /></button></DialogHeader>
}

function ModalFooter({ onCancel, saveDisabled = false }: { onCancel: () => void; saveDisabled?: boolean }) {
  return <DialogFooter className="flex-row items-center justify-end border-t border-black/10 px-4 py-3 sm:justify-end"><button type="button" onClick={onCancel} className="h-8 rounded-lg border border-black/15 px-3 text-sm font-medium hover:bg-black/[0.03]">Cancel</button><button type="submit" disabled={saveDisabled} className="h-8 rounded-lg bg-black px-3 text-sm font-medium text-white hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/15">Save</button></DialogFooter>
}

function PhoneInput() {
  return <div className="flex gap-2"><CountrySelect compact /><input aria-label="Phone number" className={inputClass} /></div>
}

function EditCustomerDialog({ open, onOpenChange, email, name }: { open: boolean; onOpenChange: (open: boolean) => void; email: string; name: string }) {
  const [firstName = "", ...remainingName] = name.split(" ")
  const lastName = remainingName.join(" ")

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[calc(100vh-2rem)] gap-0 overflow-y-auto p-0 sm:!w-[620px] sm:!max-w-[620px]" showCloseButton={false} overlayClassName="bg-black/45 supports-backdrop-filter:backdrop-blur-[1px]"><form onSubmit={(event) => { event.preventDefault(); onOpenChange(false) }}><ModalHeading title="Edit customer" onClose={() => onOpenChange(false)} /><div className="space-y-4 px-4 py-4"><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium">First Name<input defaultValue={firstName} className={inputClass} /></label><label className="grid gap-1.5 text-sm font-medium">Last Name<input defaultValue={lastName} className={inputClass} /></label></div><label className="grid gap-1.5 text-sm font-medium">Language<Select defaultValue="English [Default]"><SelectTrigger className={`${inputClass} h-8 rounded-lg border-black/30 px-3 text-sm shadow-none`}><SelectValue /></SelectTrigger><SelectContent position="popper"><SelectItem value="English [Default]">English [Default]</SelectItem><SelectItem value="Hindi">Hindi</SelectItem></SelectContent></Select><span className="font-normal text-black/60">This customer will receive notifications in this language.</span></label><label className="grid gap-1.5 text-sm font-medium">Email<input type="email" defaultValue={email} className={inputClass} /></label><label className="grid gap-1.5 text-sm font-medium">Phone number<PhoneInput /></label></div><ModalFooter onCancel={() => onOpenChange(false)} /></form></DialogContent></Dialog>
}

function AddAddressDialog({ open, onOpenChange, name }: { open: boolean; onOpenChange: (open: boolean) => void; name: string }) {
  const [firstName = "", ...remainingName] = name.split(" ")
  const lastName = remainingName.join(" ")
  const [countryCode, setCountryCode] = React.useState("IN")
  const [stateCode, setStateCode] = React.useState("")
  const [cityName, setCityName] = React.useState("")
  const states = React.useMemo(() => State.getStatesOfCountry(countryCode), [countryCode])

  const handleCountryChange = (nextCountryCode: string) => {
    setCountryCode(nextCountryCode)
    setStateCode("")
    setCityName("")
  }

  const handleStateChange = (nextStateCode: string) => {
    setStateCode(nextStateCode)
    setCityName("")
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[calc(100vh-2rem)] gap-0 overflow-y-auto p-0 sm:!w-[620px] sm:!max-w-[620px]" showCloseButton={false} overlayClassName="bg-black/45 supports-backdrop-filter:backdrop-blur-[1px]">
      <form onSubmit={(event) => { event.preventDefault(); onOpenChange(false) }}>
        <ModalHeading title="Add new address" onClose={() => onOpenChange(false)} />
        <div className="space-y-4 px-4 py-4">
          <label className="grid gap-1.5 text-sm font-medium">Country/region<CountrySelect countryCode={countryCode} onCountryChange={handleCountryChange} /></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium">First name<input defaultValue={firstName} className={inputClass} /></label><label className="grid gap-1.5 text-sm font-medium">Last name<input defaultValue={lastName} className={inputClass} /></label></div>
          <label className="grid gap-1.5 text-sm font-medium">Address<span className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-black/45" /><input className={`${inputClass} pl-9`} /></span></label>
          <label className="grid gap-1.5 text-sm font-medium">Apartment, suite, etc<input className={inputClass} /></label>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <label className="grid gap-1.5 text-sm font-medium">City<input value={cityName} onChange={(event) => setCityName(event.target.value)} className={inputClass} /></label>
            <div className="grid gap-1.5 text-sm font-medium"><span>State</span><Select value={stateCode} onValueChange={handleStateChange}><SelectTrigger size="sm" aria-label="State" className="!h-8 w-full rounded-lg border-black/30 !bg-white px-3 shadow-none focus-visible:border-black/60 focus-visible:ring-2 focus-visible:ring-black/5"><SelectValue placeholder={states.length ? "Select a state" : "No states available"} /></SelectTrigger><SelectContent position="popper" className="max-h-64"><SelectItem value="no-state" disabled>{states.length ? "Select a state" : "No states available"}</SelectItem>{states.map((state) => <SelectItem key={state.isoCode} value={state.isoCode}>{state.name}</SelectItem>)}</SelectContent></Select></div>
            <label className="grid gap-1.5 text-sm font-medium">PIN code<input className={inputClass} /></label>
          </div>
          <label className="grid gap-1.5 text-sm font-medium">Phone<PhoneInput /></label>
        </div>
        <ModalFooter onCancel={() => onOpenChange(false)} />
      </form>
    </DialogContent>
  </Dialog>
}

function MarketingChannel({
  icon,
  title,
  detail,
  enabled = true,
  checked,
  onCheckedChange,
}: {
  icon: React.ReactNode
  title: string
  detail: React.ReactNode
  enabled?: boolean
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
}) {
  return <div className="flex items-center gap-3 border-b border-black/10 px-3 py-3 last:border-b-0"><span className="text-black/65">{icon}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{title}</h3><span className="rounded-md bg-black/[0.06] px-2 py-0.5 text-xs text-black/60">Not subscribed</span></div><p className="mt-1 text-sm text-black/65">{detail}</p></div>{enabled ? <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={`Toggle ${title} marketing`} /> : <Switch checked={false} disabled aria-label={`${title} marketing unavailable`} />}</div>
}

function MarketingDialog({ open, onOpenChange, email }: { open: boolean; onOpenChange: (open: boolean) => void; email: string }) {
  const [emailSubscribed, setEmailSubscribed] = React.useState(false)

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="gap-0 overflow-hidden p-0 sm:!w-[620px] sm:!max-w-[620px]" showCloseButton={false} overlayClassName="bg-black/45 supports-backdrop-filter:backdrop-blur-[1px]"><form onSubmit={(event) => { event.preventDefault(); onOpenChange(false) }}><ModalHeading title="Edit marketing status" onClose={() => onOpenChange(false)} /><div className="px-4 py-4"><p className="text-sm text-black/75">Indicate which marketing channels the customer has agreed to receive messages from:</p><div className="mt-4 overflow-hidden rounded-lg border border-black/10"><MarketingChannel icon={<Mail className="size-4" />} title="Email" detail={email} checked={emailSubscribed} onCheckedChange={setEmailSubscribed} /><MarketingChannel icon={<MessageSquare className="size-4" />} title="SMS" detail={<span className="underline decoration-dotted underline-offset-3">Phone number not provided</span>} enabled={false} checked={false} /><MarketingChannel icon={<Smartphone className="size-4" />} title="WhatsApp" detail={<span className="underline decoration-dotted underline-offset-3">Phone number not provided</span>} enabled={false} checked={false} /></div></div><ModalFooter onCancel={() => onOpenChange(false)} saveDisabled={!emailSubscribed} /></form></DialogContent></Dialog>
}

export function CustomerActions({ email, name }: { email: string; name: string }) {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [modal, setModal] = React.useState<ModalName>(null)

  const openModal = (nextModal: Exclude<ModalName, null>) => {
    setMenuOpen(false)
    setModal(nextModal)
  }

  return <><Popover open={menuOpen} onOpenChange={setMenuOpen}><PopoverTrigger asChild><button type="button" aria-label="Customer options" className="rounded-lg bg-black/[0.06] p-1.5 text-black/50 transition hover:bg-black/10 hover:text-black"><MoreHorizontal className="size-4" /></button></PopoverTrigger><PopoverContent align="end" sideOffset={6} className="w-[210px] gap-0 rounded-xl p-1.5 shadow-lg"><div role="menu" aria-label="Customer actions"><button type="button" role="menuitem" onClick={() => openModal("customer")} className="flex h-8 w-full items-center rounded-lg px-2.5 text-left text-sm text-black/80 transition hover:bg-black/[0.05]">Edit contact information</button><button type="button" role="menuitem" onClick={() => openModal("address")} className="flex h-8 w-full items-center rounded-lg px-2.5 text-left text-sm text-black/80 transition hover:bg-black/[0.05]">Add address</button><button type="button" role="menuitem" onClick={() => openModal("marketing")} className="flex h-8 w-full items-center rounded-lg px-2.5 text-left text-sm text-black/80 transition hover:bg-black/[0.05]">Edit marketing settings</button></div></PopoverContent></Popover><EditCustomerDialog open={modal === "customer"} onOpenChange={(open) => !open && setModal(null)} email={email} name={name} /><AddAddressDialog open={modal === "address"} onOpenChange={(open) => !open && setModal(null)} name={name} /><MarketingDialog open={modal === "marketing"} onOpenChange={(open) => !open && setModal(null)} email={email} /></>
}
