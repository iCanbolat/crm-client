import { startOfDay } from "date-fns"
import { enUS, tr } from "react-day-picker/locale"

import { Calendar } from "@/components/ui/calendar"

/**
 * The picker's calendar, loaded with the popover (react-day-picker and its
 * locales stay out of the bundles that only render a trigger).
 */
export default function DatePickerCalendar({
  selected,
  min,
  max,
  language,
  onSelect,
}: {
  selected: Date | undefined
  min: Date | undefined
  max: Date | undefined
  language: string
  onSelect: (date: Date | undefined) => void
}) {
  const year = new Date().getFullYear()
  const matchers = [
    ...(min ? [{ before: startOfDay(min) }] : []),
    ...(max ? [{ after: startOfDay(max) }] : []),
  ]
  return (
    <Calendar
      key={language}
      mode="single"
      captionLayout="dropdown"
      locale={language.startsWith("tr") ? tr : enUS}
      selected={selected}
      defaultMonth={selected ?? max ?? min}
      startMonth={min ?? new Date(year - 100, 0)}
      endMonth={max ?? new Date(year + 20, 11)}
      disabled={matchers.length ? matchers : undefined}
      onSelect={onSelect}
    />
  )
}
