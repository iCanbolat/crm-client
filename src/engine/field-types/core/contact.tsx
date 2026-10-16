import { GlobeIcon, PhoneIcon } from "lucide-react"
import { z } from "zod"

import {
  COUNTRIES,
  COUNTRY_CODES,
  getCountryFlag,
  getCountryName,
  getDialCode,
} from "@/lib/countries"
import { getCurrentLanguage, type Language } from "@/lib/i18n"

import { lazyFieldInput } from "../lazy"
import type { FieldTypeDefinition } from "../types"
import { EmptyValue } from "../ui"
import { isBlank, message, textComparable } from "./shared"

/* ------------------------------------------------------------------ phone */

export const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/

/** Country whose calling code prefixes an E.164 number (longest match). */
export function countryOfPhone(value: string | null | undefined) {
  if (!value?.startsWith("+")) return undefined
  return [...COUNTRIES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((country) => value.startsWith(`+${country.dial}`))?.code
}

/** "+905321234567" → "+90 532 123 4567". */
export function formatPhone(value: string) {
  const country = countryOfPhone(value)
  const dial = country ? getDialCode(country) : undefined
  if (!dial) return value
  const national = value
    .slice(dial.length + 1)
    .replace(/^(\d{3})(\d{3})(\d+)$/, "$1 $2 $3")
  return `+${dial} ${national}`
}

export const phoneFieldType: FieldTypeDefinition<string> = {
  type: "phone",
  icon: PhoneIcon,
  toZod: () => z.string().regex(PHONE_PATTERN, message.phone),
  isEmpty: isBlank,
  toComparable: textComparable,
  format: formatPhone,
  filterOperators: ["contains", "startsWith", "isEmpty", "isNotEmpty"],
  sortable: true,
  creatable: true,
  Cell: ({ value }) =>
    isBlank(value) || !value ? (
      <EmptyValue />
    ) : (
      <a
        href={`tel:${value}`}
        className="text-primary tabular-nums underline-offset-4 hover:underline"
        onClick={(event) => event.stopPropagation()}
      >
        {formatPhone(value)}
      </a>
    ),
  Input: lazyFieldInput(() =>
    import("./inputs").then((module) => module.PhoneInput)
  ),
}

/* ---------------------------------------------------------------- country */

export interface CountryItem {
  value: string
  label: string
}

export function countryItems(language: Language): CountryItem[] {
  return COUNTRY_CODES.map((code) => ({
    value: code,
    label: getCountryName(code, language),
  })).sort((a, b) => a.label.localeCompare(b.label, language))
}

export const countryFieldType: FieldTypeDefinition<string> = {
  type: "country",
  icon: GlobeIcon,
  toZod: () => z.enum(COUNTRY_CODES as [string, ...string[]], message.country),
  isEmpty: isBlank,
  toComparable: textComparable,
  format: (value, { language }) => getCountryName(value, language),
  filterOperators: ["in", "notIn", "isEmpty", "isNotEmpty"],
  sortable: true,
  getOptions: (_field, { language }) => countryItems(language),
  creatable: true,
  Cell: ({ value }) =>
    isBlank(value) || !value ? (
      <EmptyValue />
    ) : (
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden>{getCountryFlag(value)}</span>
        {getCountryName(value, getCurrentLanguage())}
      </span>
    ),
  Input: lazyFieldInput(() =>
    import("./inputs").then((module) => module.CountryInput)
  ),
}
