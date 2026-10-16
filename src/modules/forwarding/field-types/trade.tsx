import { FlameIcon, ScanBarcodeIcon } from "lucide-react"
import { z } from "zod"

import { Input } from "@/components/ui/input"
import {
  EmptyValue,
  inputA11yProps,
  isBlank,
  textComparable,
  type FieldInputProps,
  type FieldTypeDefinition,
  lazyFieldInput,
} from "@/engine/field-types"
import i18n from "@/lib/i18n"

import { IMO_CLASSES } from "../lib/constants"

/* ------------------------------------------------------------------ HS code */

export const HS_CODE_PATTERN = /^\d{4}(\.?\d{2}){0,3}$/

const hsMessage = {
  error: () => i18n.t("forwarding:fieldTypes.validation.hsCode"),
}

export const hsCodeFieldType: FieldTypeDefinition<string> = {
  type: "hsCode",
  icon: ScanBarcodeIcon,
  toZod: () => z.string().trim().regex(HS_CODE_PATTERN, hsMessage),
  isEmpty: isBlank,
  toComparable: textComparable,
  format: (value) => value,
  filterOperators: ["eq", "startsWith", "isEmpty", "isNotEmpty"],
  sortable: true,
  creatable: true,
  Cell: ({ value }) =>
    isBlank(value) ? (
      <EmptyValue />
    ) : (
      <span className="font-mono text-sm">{value}</span>
    ),
  Input: (props: FieldInputProps<string>) => (
    <Input
      {...inputA11yProps(props)}
      inputMode="numeric"
      placeholder="8471.30"
      value={props.value ?? ""}
      onChange={(event) => props.onChange(event.target.value || null)}
    />
  ),
}

/* --------------------------------------------------------- dangerous goods */

export interface DangerousGoodsValue {
  imoClass: string
  unNumber: string
}

const unMessage = {
  error: () => i18n.t("forwarding:fieldTypes.validation.unNumber"),
}

const dangerousGoodsSchema = z.object({
  imoClass: z.enum(IMO_CLASSES),
  unNumber: z.string().regex(/^\d{4}$/, unMessage),
})

export function toDangerousGoods(value: unknown): DangerousGoodsValue | null {
  const parsed = dangerousGoodsSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/** "IMO 3 · UN1203" */
export function formatDangerousGoods(value: DangerousGoodsValue) {
  return `IMO ${value.imoClass} · UN${value.unNumber}`
}

export const dangerousGoodsFieldType: FieldTypeDefinition<DangerousGoodsValue> =
  {
    type: "dangerousGoods",
    icon: FlameIcon,
    toZod: () => dangerousGoodsSchema,
    isEmpty: (value) => toDangerousGoods(value) === null,
    toComparable: (value) => toDangerousGoods(value)?.imoClass ?? null,
    format: (value) => formatDangerousGoods(value),
    filterOperators: ["eq", "isEmpty", "isNotEmpty"],
    sortable: true,
    creatable: false,
    Cell: ({ value }) => {
      const goods = toDangerousGoods(value)
      return goods ? (
        <span className="inline-flex items-center gap-1 text-sm">
          <FlameIcon className="size-3.5 text-destructive" aria-hidden />
          {formatDangerousGoods(goods)}
        </span>
      ) : (
        <EmptyValue />
      )
    },
    Input: lazyFieldInput(() =>
      import("./inputs").then((module) => module.DangerousGoodsInput)
    ),
  }
