import { format as formatPattern, isValid, parseISO } from "date-fns"
import { CalendarClockIcon, CalendarIcon } from "lucide-react"
import { z } from "zod"

import { Input } from "@/components/ui/input"
import { formatDate } from "@/lib/format"
import { getCurrentLanguage } from "@/lib/i18n"

import type { FieldInputProps, FieldTypeDefinition } from "../types"
import { EmptyValue } from "../ui"
import { inputA11yProps, isBlank } from "./shared"

const DATE_OPERATORS = [
  "on",
  "before",
  "after",
  "between",
  "isEmpty",
  "isNotEmpty",
] as const

/** Parses `YYYY-MM-DD` as a local date (not UTC midnight). */
function parseValue(value: unknown) {
  if (typeof value !== "string" || !value) return null
  const date = parseISO(value)
  return isValid(date) ? date : null
}

const dateComparable = (value: unknown) =>
  parseValue(value) ? String(value) : null

function formatDay(value: string, language: string) {
  const date = parseValue(value)
  return date ? formatDate(date, language) : value
}

function formatDateTime(value: string, language: string) {
  const date = parseValue(value)
  return date
    ? formatDate(date, language, { dateStyle: "medium", timeStyle: "short" })
    : value
}

function DateInput(props: FieldInputProps<string>) {
  return (
    <Input
      {...inputA11yProps(props)}
      type="date"
      value={props.value ?? ""}
      onChange={(event) => props.onChange(event.target.value || null)}
    />
  )
}

/** ISO instant ↔ `<input type="datetime-local">` (the user's time zone). */
export function toLocalInputValue(value: string | null | undefined) {
  const date = parseValue(value)
  return date ? formatPattern(date, "yyyy-MM-dd'T'HH:mm") : ""
}

export function fromLocalInputValue(value: string) {
  if (!value) return null
  const date = new Date(value)
  return isValid(date) ? date.toISOString() : null
}

function DateTimeInput(props: FieldInputProps<string>) {
  return (
    <Input
      {...inputA11yProps(props)}
      type="datetime-local"
      value={toLocalInputValue(props.value)}
      onChange={(event) =>
        props.onChange(fromLocalInputValue(event.target.value))
      }
    />
  )
}

function DateCell({
  value,
  render,
}: {
  value: string | null | undefined
  render: (value: string, language: string) => string
}) {
  if (isBlank(value) || !value) return <EmptyValue />
  return (
    <time dateTime={value} className="tabular-nums">
      {render(value, getCurrentLanguage())}
    </time>
  )
}

export const dateFieldType: FieldTypeDefinition<string> = {
  type: "date",
  icon: CalendarIcon,
  toZod: () => z.iso.date(),
  isEmpty: (value) => parseValue(value) === null,
  toComparable: dateComparable,
  format: (value, { language }) => formatDay(value, language),
  filterOperators: DATE_OPERATORS,
  sortable: true,
  creatable: true,
  Cell: ({ value }) => <DateCell value={value} render={formatDay} />,
  Input: DateInput,
}

export const datetimeFieldType: FieldTypeDefinition<string> = {
  type: "datetime",
  icon: CalendarClockIcon,
  toZod: () => z.iso.datetime({ offset: true }),
  isEmpty: (value) => parseValue(value) === null,
  toComparable: dateComparable,
  format: (value, { language }) => formatDateTime(value, language),
  filterOperators: DATE_OPERATORS,
  sortable: true,
  creatable: true,
  Cell: ({ value }) => <DateCell value={value} render={formatDateTime} />,
  Input: DateTimeInput,
}
