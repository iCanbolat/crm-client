import { useState } from "react"
import { useTranslation } from "react-i18next"

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
import { COUNTRIES, getCountryFlag, getDialCode } from "@/lib/countries"
import { getCurrentLanguage } from "@/lib/i18n"

import { useFieldServices } from "../services"
import type { FieldInputProps } from "../types"
import { countryItems, countryOfPhone, type CountryItem } from "./contact"
import { inputA11yProps } from "./shared"

// Inputs of ./contact, loaded on first render (see ../lazy).

export function PhoneInput(props: FieldInputProps<string>) {
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

export function CountryInput(props: FieldInputProps<string>) {
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
