"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"))
const minutes = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0"))

function formatDateTime(value: Date | undefined) {
  if (!value) return "Pick a date and time"
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value)
}

function updateTime(value: Date | undefined, hour: number, minute: number) {
  const next = value ? new Date(value) : new Date()
  next.setHours(hour, minute, 0, 0)
  return next
}

export function DateTimePicker({
  value,
  onChange,
  disabled,
  className,
  placeholder = "Pick a date and time",
}: {
  value?: Date
  onChange: (value: Date) => void
  disabled?: boolean
  className?: string
  placeholder?: string
}) {
  const [open, setOpen] = React.useState(false)
  const hour = String(value?.getHours() ?? new Date().getHours()).padStart(2, "0")
  const minute = String(value?.getMinutes() ?? new Date().getMinutes()).padStart(2, "0")

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-start rounded-lg border-black/20 bg-white px-3 text-left text-sm font-normal shadow-none hover:bg-black/[0.02]",
            !value && "text-black/45",
            className,
          )}
        >
          <CalendarIcon className="mr-2 size-4 text-black/55" />
          {value ? formatDateTime(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto gap-0 overflow-hidden p-0" sideOffset={6}>
        <Calendar
          mode="single"
          selected={value}
          onSelect={(day) => {
            if (!day) return
            onChange(updateTime(day, Number(hour), Number(minute)))
          }}
          autoFocus
        />
        <div className="grid grid-cols-2 gap-2 border-t border-black/10 p-3">
          <label className="grid gap-1 text-xs font-medium text-black/60">
            Hour
            <Select value={hour} onValueChange={(nextHour) => onChange(updateTime(value, Number(nextHour), Number(minute)))}>
              <SelectTrigger size="sm" className="h-9 w-full rounded-md border-black/20 bg-white text-black shadow-none"><SelectValue /></SelectTrigger>
              <SelectContent position="popper" className="max-h-60"><SelectItem value="00">00</SelectItem>{hours.slice(1).map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-black/60">
            Minute
            <Select value={minute} onValueChange={(nextMinute) => onChange(updateTime(value, Number(hour), Number(nextMinute)))}>
              <SelectTrigger size="sm" className="h-9 w-full rounded-md border-black/20 bg-white text-black shadow-none"><SelectValue /></SelectTrigger>
              <SelectContent position="popper" className="max-h-60"><SelectItem value="00">00</SelectItem>{minutes.slice(1).map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
            </Select>
          </label>
        </div>
        <div className="flex justify-end border-t border-black/10 p-2">
          <Button type="button" size="sm" onClick={() => setOpen(false)}>Done</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
