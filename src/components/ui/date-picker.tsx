"use client"

import * as React from "react"
import { format, isSameDay, isValid, parse } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { cn } from "cn"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatDate } from "@/lib/format"

const DATE_FORMAT = "yyyy-MM-dd"
const DATE_TIME_FORMAT = "yyyy-MM-dd'T'HH:mm"
const TIME_FORMAT = "HH:mm"

/** Native-input-compatible value strings: `YYYY-MM-DD` / `YYYY-MM-DDTHH:mm`. */
function parseValue(value: string | null | undefined, pattern: string) {
  if (!value) return undefined
  const date = parse(value, pattern, new Date())
  return isValid(date) ? date : undefined
}

function useLanguage() {
  const { i18n } = useTranslation()
  return i18n.resolvedLanguage ?? i18n.language
}

// react-day-picker loads with the first popover (bundle budgets, Faz 8);
// hovering or focusing a trigger starts the download early.
const loadCalendar = () => import("./date-picker-calendar")
const LazyCalendar = React.lazy(loadCalendar)

interface PickerProps {
  id?: string
  value: string | null | undefined
  onChange: (value: string) => void
  /** Inclusive bounds, same format as `value`. */
  min?: string
  max?: string
  disabled?: boolean
  placeholder?: string
  className?: string
  autoFocus?: boolean
  onBlur?: React.FocusEventHandler<HTMLButtonElement>
  "aria-invalid"?: boolean
  "aria-describedby"?: string
  "aria-label"?: string
}

function PickerTrigger({
  label,
  placeholder,
  className,
  ...props
}: Omit<
  PickerProps,
  "value" | "onChange" | "min" | "max" | "placeholder" | "className"
> & { label: string | null; placeholder: string; className?: string }) {
  return (
    <PopoverTrigger
      render={
        <Button
          type="button"
          variant="outline"
          data-empty={label ? undefined : true}
          onPointerEnter={loadCalendar}
          onFocus={loadCalendar}
          className={cn(
            "w-full min-w-40 justify-start font-normal data-[empty]:text-muted-foreground",
            className
          )}
          {...props}
        />
      }
    >
      <CalendarIcon aria-hidden />
      <span className="truncate">{label ?? placeholder}</span>
    </PopoverTrigger>
  )
}

function CalendarFor(props: React.ComponentProps<typeof LazyCalendar>) {
  return (
    <React.Suspense fallback={<div className="size-72" aria-busy />}>
      <LazyCalendar {...props} />
    </React.Suspense>
  )
}

/** shadcn date picker (Popover + Calendar). Value is a `YYYY-MM-DD` string. */
function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder,
  className,
  ...triggerProps
}: PickerProps) {
  const { t } = useTranslation("common")
  const language = useLanguage()
  const [open, setOpen] = React.useState(false)
  const date = parseValue(value, DATE_FORMAT)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PickerTrigger
        label={date ? formatDate(date, language) : null}
        placeholder={placeholder ?? t("datePicker.placeholder")}
        className={className}
        {...triggerProps}
      />
      <PopoverContent align="start" className="w-auto p-0">
        <CalendarFor
          selected={date}
          min={parseValue(min, DATE_FORMAT)}
          max={parseValue(max, DATE_FORMAT)}
          language={language}
          onSelect={(next) => {
            onChange(next ? format(next, DATE_FORMAT) : "")
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

/**
 * Date + time picker. Value is a local `YYYY-MM-DDTHH:mm` string (the same
 * shape `<input type="datetime-local">` used), `""` when empty.
 */
function DateTimePicker({
  value,
  onChange,
  min,
  max,
  placeholder,
  className,
  ...triggerProps
}: PickerProps) {
  const { t } = useTranslation("common")
  const language = useLanguage()
  const date = parseValue(value, DATE_TIME_FORMAT)
  const minDate = parseValue(min, DATE_TIME_FORMAT)
  const maxDate = parseValue(max, DATE_TIME_FORMAT)
  const time = date ? format(date, TIME_FORMAT) : "00:00"
  const timeId = React.useId()

  function emit(day: Date, nextTime: string) {
    onChange(`${format(day, DATE_FORMAT)}T${nextTime}`)
  }

  return (
    <Popover>
      <PickerTrigger
        label={
          date
            ? formatDate(date, language, {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : null
        }
        placeholder={placeholder ?? t("datePicker.dateTimePlaceholder")}
        className={className}
        {...triggerProps}
      />
      <PopoverContent align="start" className="w-auto gap-0 p-0">
        <CalendarFor
          selected={date}
          min={minDate}
          max={maxDate}
          language={language}
          onSelect={(next) => (next ? emit(next, time) : onChange(""))}
        />
        <div className="flex items-center gap-3 border-t p-3">
          <label htmlFor={timeId} className="text-sm text-muted-foreground">
            {t("datePicker.time")}
          </label>
          <Input
            id={timeId}
            type="time"
            step={60}
            value={time}
            disabled={!date}
            min={
              date && minDate && isSameDay(date, minDate)
                ? format(minDate, TIME_FORMAT)
                : undefined
            }
            max={
              date && maxDate && isSameDay(date, maxDate)
                ? format(maxDate, TIME_FORMAT)
                : undefined
            }
            className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
            onChange={(event) => {
              if (date && event.target.value) emit(date, event.target.value)
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker, DateTimePicker }
