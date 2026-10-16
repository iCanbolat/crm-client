import { BanknoteIcon, HashIcon, PercentIcon } from "lucide-react"
import { z } from "zod"

import { Input } from "@/components/ui/input"
import { formatMoney } from "@/lib/currencies"
import { formatNumber } from "@/lib/format"
import { getCurrentLanguage } from "@/lib/i18n"

import type { FieldDef } from "../../metadata/schemas"
import { lazyFieldInput } from "../lazy"
import type {
  FieldCellProps,
  FieldInputProps,
  FieldTypeDefinition,
} from "../types"
import { EmptyValue } from "../ui"
import { inputA11yProps, message } from "./shared"

const NUMBER_OPERATORS = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "isEmpty",
  "isNotEmpty",
] as const

function numberSchema(field: FieldDef) {
  let schema = z.number()
  const { min, max } = field.validation ?? {}
  if (min !== undefined) schema = schema.min(min, message.min(min))
  if (max !== undefined) schema = schema.max(max, message.max(max))
  return schema
}

const toNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null

export function parseNumber(raw: string) {
  if (raw.trim() === "") return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function NumberInput(props: FieldInputProps<number>) {
  return (
    <Input
      {...inputA11yProps(props)}
      type="number"
      step="any"
      inputMode="decimal"
      value={props.value ?? ""}
      onChange={(event) => props.onChange(parseNumber(event.target.value))}
    />
  )
}

function NumericCell({ text }: { text: string | null }) {
  if (text === null) return <EmptyValue />
  return <span className="tabular-nums">{text}</span>
}

export const numberFieldType: FieldTypeDefinition<number> = {
  type: "number",
  icon: HashIcon,
  toZod: numberSchema,
  isEmpty: (value) => toNumber(value) === null,
  toComparable: toNumber,
  format: (value, { language }) => formatNumber(value, language),
  filterOperators: NUMBER_OPERATORS,
  sortable: true,
  creatable: true,
  Cell: ({ value }: FieldCellProps<number>) => (
    <NumericCell
      text={
        toNumber(value) === null
          ? null
          : formatNumber(value as number, getCurrentLanguage())
      }
    />
  ),
  Input: NumberInput,
}

const formatPercent = (value: number, language: string) =>
  formatNumber(value / 100, language, {
    style: "percent",
    maximumFractionDigits: 2,
  })

export const percentFieldType: FieldTypeDefinition<number> = {
  ...numberFieldType,
  type: "percent",
  icon: PercentIcon,
  toZod: (field) =>
    numberSchema({
      ...field,
      validation: { min: 0, max: 100, ...field.validation },
    }),
  format: (value, { language }) => formatPercent(value, language),
  Cell: ({ value }) => (
    <NumericCell
      text={
        toNumber(value) === null
          ? null
          : formatPercent(value as number, getCurrentLanguage())
      }
    />
  ),
}

/* ----------------------------------------------------------------------------
 * Currency: `{ amount, currency }` — deals of one tenant span currencies.
 * ------------------------------------------------------------------------- */

export interface MoneyValue {
  amount: number
  currency: string
}

export function toMoney(value: unknown): MoneyValue | null {
  if (typeof value !== "object" || value === null) return null
  const { amount, currency } = value as Partial<MoneyValue>
  return typeof amount === "number" && typeof currency === "string"
    ? { amount, currency }
    : null
}

export const currencyFieldType: FieldTypeDefinition<MoneyValue> = {
  type: "currency",
  icon: BanknoteIcon,
  toZod: (field) =>
    z.object({
      amount: numberSchema(field),
      currency: z.string().regex(/^[A-Z]{3}$/),
    }),
  isEmpty: (value) => toMoney(value) === null,
  toComparable: (value) => toMoney(value)?.amount ?? null,
  format: (value, { language }) =>
    formatMoney(value.amount, value.currency, language),
  filterOperators: NUMBER_OPERATORS,
  sortable: true,
  creatable: true,
  Cell: ({ value }) => {
    const money = toMoney(value)
    return (
      <NumericCell
        text={
          money
            ? formatMoney(money.amount, money.currency, getCurrentLanguage())
            : null
        }
      />
    )
  },
  Input: lazyFieldInput(() =>
    import("./inputs").then((module) => module.CurrencyInput)
  ),
}
