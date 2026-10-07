import { FlameIcon, ScanBarcodeIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  EmptyValue,
  inputA11yProps,
  isBlank,
  textComparable,
  type FieldInputProps,
  type FieldTypeDefinition,
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

function DangerousGoodsInput(props: FieldInputProps<DangerousGoodsValue>) {
  const { t } = useTranslation("forwarding")
  const current =
    props.value && typeof props.value === "object"
      ? props.value
      : { imoClass: "", unNumber: "" }
  const update = (next: Partial<DangerousGoodsValue>) => {
    const value = { ...current, ...next }
    props.onChange(value.imoClass || value.unNumber ? value : null)
  }
  const items = IMO_CLASSES.map((value) => ({
    value,
    label: t("fieldTypes.imoClassValue", { value }),
  }))

  return (
    <div
      className="flex gap-2"
      role="group"
      aria-labelledby={props.labelId}
      aria-label={props.labelId ? undefined : props.ariaLabel}
    >
      <Select
        items={items}
        value={current.imoClass || null}
        onValueChange={(imoClass) =>
          update({ imoClass: typeof imoClass === "string" ? imoClass : "" })
        }
        disabled={props.disabled}
      >
        <SelectTrigger
          id={props.id}
          className="w-36"
          aria-label={t("fieldTypes.imoClass")}
          aria-invalid={props.invalid ? true : undefined}
          aria-describedby={props.describedBy}
        >
          <SelectValue placeholder={t("fieldTypes.imoClass")} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        className="flex-1"
        inputMode="numeric"
        maxLength={4}
        placeholder="1203"
        aria-label={t("fieldTypes.unNumber")}
        aria-invalid={props.invalid ? true : undefined}
        aria-describedby={props.describedBy}
        disabled={props.disabled}
        onBlur={props.onBlur}
        value={current.unNumber}
        onChange={(event) => update({ unNumber: event.target.value.trim() })}
      />
    </div>
  )
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
    Input: DangerousGoodsInput,
  }
