import { useTranslation } from "react-i18next"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { type FieldInputProps } from "@/engine/field-types"

import { IMO_CLASSES } from "../lib/constants"
import { type DangerousGoodsValue } from "./trade"

// Inputs of ./trade, loaded on first render (lazyFieldInput).

export function DangerousGoodsInput(
  props: FieldInputProps<DangerousGoodsValue>
) {
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
