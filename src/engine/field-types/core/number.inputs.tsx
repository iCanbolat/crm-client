import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CURRENCIES } from "@/lib/currencies"

import { useFieldServices } from "../services"
import type { FieldInputProps } from "../types"
import { parseNumber, toMoney, type MoneyValue } from "./number"
import { inputA11yProps } from "./shared"

// Inputs of ./number, loaded on first render (see ../lazy).

export function CurrencyInput(props: FieldInputProps<MoneyValue>) {
  const { t } = useTranslation("engine")
  const { defaultCurrency } = useFieldServices()
  // A currency picked before any amount was typed.
  const [preferred, setPreferred] = useState<string | null>(null)
  const money = toMoney(props.value)
  const currency = money?.currency ?? preferred ?? defaultCurrency

  return (
    <div className="flex gap-2">
      <Input
        {...inputA11yProps(props)}
        type="number"
        step="any"
        inputMode="decimal"
        className="flex-1"
        value={money?.amount ?? ""}
        onChange={(event) => {
          const amount = parseNumber(event.target.value)
          props.onChange(amount === null ? null : { amount, currency })
        }}
      />
      <Select
        items={CURRENCIES.map((code) => ({ value: code, label: code }))}
        value={currency}
        onValueChange={(next) => {
          if (typeof next !== "string") return
          setPreferred(next)
          if (money) props.onChange({ amount: money.amount, currency: next })
        }}
        disabled={props.disabled}
      >
        <SelectTrigger
          className="w-24"
          aria-label={t("input.currency")}
          aria-invalid={props.invalid ? true : undefined}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CURRENCIES.map((code) => (
            <SelectItem key={code} value={code}>
              {code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
