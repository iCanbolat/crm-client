import { GlobeIcon, PhoneIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { LabelledComboboxInput } from "@/components/common/combobox-input"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  COUNTRIES,
  COUNTRY_CODES,
  getCountryFlag,
  getCountryName,
  getDialCode,
} from "@/lib/countries"
import { getCurrentLanguage, type Language } from "@/lib/i18n"

import { useFieldServices } from "../services"
import type { FieldInputProps, FieldTypeDefinition } from "../types"
import { EmptyValue } from "../ui"
import { inputA11yProps, isBlank, message, textComparable } from "./shared"

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

function PhoneInput(props: FieldInputProps<string>) {
  const { t } = useTranslation("engine")
  const { defaultCountry } = useFieldServices()
  const [country, setCountry] = useState(
    () => countryOfPhone(props.value) ?? defaultCountry
  )
  const dial = getDialCode(country) ?? ""
  const national =
    props.value && props.value.startsWith(`+${dial}`)
      ? props.value.slice(dial.length + 1)
      : (props.value ?? "")

  function emit(nextDial: string, digits: string) {
    const clean = digits.replace(/\D/g, "").replace(/^0+/, "")
    props.onChange(clean ? `+${nextDial}${clean}` : null)
  }

  return (
    <div className="flex gap-2">
      <Select
        items={COUNTRIES.map((item) => ({
          value: item.code,
          label: `${getCountryFlag(item.code)} +${item.dial}`,
        }))}
        value={country}
        onValueChange={(next) => {
          if (typeof next !== "string") return
          setCountry(next)
          emit(getDialCode(next) ?? "", national)
        }}
        disabled={props.disabled}
      >
        <SelectTrigger className="w-28" aria-label={t("input.dialCode")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COUNTRIES.map((item) => (
            <SelectItem key={item.code} value={item.code}>
              {getCountryFlag(item.code)} +{item.dial}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        {...inputA11yProps(props)}
        type="tel"
        inputMode="tel"
        autoComplete="off"
        className="flex-1"
        value={national}
        onChange={(event) => emit(dial, event.target.value)}
      />
    </div>
  )
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
  Input: PhoneInput,
}

/* ---------------------------------------------------------------- country */

interface CountryItem {
  value: string
  label: string
}

function countryItems(language: Language): CountryItem[] {
  return COUNTRY_CODES.map((code) => ({
    value: code,
    label: getCountryName(code, language),
  })).sort((a, b) => a.label.localeCompare(b.label, language))
}

function CountryInput(props: FieldInputProps<string>) {
  const { t } = useTranslation("engine")
  const items = countryItems(getCurrentLanguage())
  const selected = items.find((item) => item.value === props.value) ?? null

  return (
    <Combobox
      items={items}
      value={selected}
      onValueChange={(item) => props.onChange(item?.value ?? null)}
      isItemEqualToValue={(item, value) => item.value === value.value}
      disabled={props.disabled}
    >
      <LabelledComboboxInput
        triggerLabel={t("input.openList")}
        clearLabel={t("input.clear")}
        {...inputA11yProps(props)}
        className="w-full"
        placeholder={t("input.countrySearch")}
        showClear={!props.field.required && selected !== null}
      />
      <ComboboxContent>
        <ComboboxEmpty>{t("input.noResults")}</ComboboxEmpty>
        <ComboboxList>
          {(item: CountryItem) => (
            <ComboboxItem key={item.value} value={item}>
              <span aria-hidden>{getCountryFlag(item.value)}</span>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
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
  Input: CountryInput,
}
