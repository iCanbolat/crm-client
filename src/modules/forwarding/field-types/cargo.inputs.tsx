import { PlusIcon, Trash2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { type FieldInputProps } from "@/engine/field-types"
import { formatNumber } from "@/lib/format"
import { resolveI18nText } from "@/lib/i18n-text"

import { calcCbm, type DimensionLine } from "../lib/cargo"
import { CONTAINER_TYPES } from "../lib/constants"
import { parseNumber, toDimensions, type ContainerLine } from "./cargo"

// Inputs of ./cargo, loaded on first render (lazyFieldInput).

const DIMENSION_KEYS = ["length", "width", "height", "quantity"] as const

export function ContainerInput(props: FieldInputProps<ContainerLine[]>) {
  const { t, i18n: i18next } = useTranslation("forwarding")
  const lines = Array.isArray(props.value) ? props.value : []
  const language = i18next.language === "en" ? "en" : "tr"
  const items = CONTAINER_TYPES.map((item) => ({
    value: item.code,
    label: `${item.code} — ${resolveI18nText(item.label, language)}`,
  }))
  const update = (next: ContainerLine[]) =>
    props.onChange(next.length ? next : null)

  return (
    <div
      id={props.id}
      tabIndex={-1}
      className="flex flex-col gap-2 outline-none"
      role="group"
      aria-labelledby={props.labelId}
      aria-label={props.labelId ? undefined : props.ariaLabel}
      aria-describedby={props.describedBy}
    >
      {lines.map((line, index) => (
        <div key={index} className="flex items-center gap-2">
          <Select
            items={items}
            value={line.type}
            onValueChange={(type) => {
              if (typeof type !== "string") return
              update(
                lines.map((item, i) => (i === index ? { ...item, type } : item))
              )
            }}
            disabled={props.disabled}
          >
            <SelectTrigger
              className="flex-1"
              aria-label={t("fieldTypes.containerType")}
              aria-invalid={props.invalid ? true : undefined}
            >
              <SelectValue />
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
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            className="w-20"
            aria-label={t("fieldTypes.containerCount")}
            value={Number.isFinite(line.count) ? line.count : ""}
            disabled={props.disabled}
            onBlur={props.onBlur}
            onChange={(event) => {
              const count = parseNumber(event.target.value) ?? Number.NaN
              update(
                lines.map((item, i) =>
                  i === index ? { ...item, count } : item
                )
              )
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("fieldTypes.removeRow")}
            disabled={props.disabled}
            onClick={() => update(lines.filter((_, i) => i !== index))}
          >
            <Trash2Icon aria-hidden />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={props.disabled}
        autoFocus={props.autoFocus && lines.length === 0}
        onClick={() => update([...lines, { type: "40HC", count: 1 }])}
      >
        <PlusIcon aria-hidden />
        {t("fieldTypes.addContainer")}
      </Button>
    </div>
  )
}

export function DimensionsInput(props: FieldInputProps<DimensionLine[]>) {
  const { t, i18n: i18next } = useTranslation("forwarding")
  const lines = Array.isArray(props.value) ? props.value : []
  const update = (next: DimensionLine[]) =>
    props.onChange(next.length ? next : null)
  const valid = toDimensions(lines)

  return (
    <div
      id={props.id}
      tabIndex={-1}
      className="flex flex-col gap-2 outline-none"
      role="group"
      aria-labelledby={props.labelId}
      aria-label={props.labelId ? undefined : props.ariaLabel}
      aria-describedby={props.describedBy}
    >
      {lines.map((line, index) => (
        <div
          key={index}
          className="grid grid-cols-[repeat(4,minmax(0,1fr))_auto] gap-2"
        >
          {DIMENSION_KEYS.map((key) => (
            <Input
              key={key}
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              aria-label={t(`fieldTypes.${key}`)}
              placeholder={t(`fieldTypes.${key}`)}
              aria-invalid={props.invalid ? true : undefined}
              value={Number.isFinite(line[key]) ? line[key] : ""}
              disabled={props.disabled}
              onBlur={props.onBlur}
              onChange={(event) => {
                const value = parseNumber(event.target.value) ?? Number.NaN
                update(
                  lines.map((item, i) =>
                    i === index ? { ...item, [key]: value } : item
                  )
                )
              }}
            />
          ))}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("fieldTypes.removeRow")}
            disabled={props.disabled}
            onClick={() => update(lines.filter((_, i) => i !== index))}
          >
            <Trash2Icon aria-hidden />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={props.disabled}
          autoFocus={props.autoFocus && lines.length === 0}
          onClick={() =>
            update([
              ...lines,
              { length: 120, width: 80, height: 100, quantity: 1 },
            ])
          }
        >
          <PlusIcon aria-hidden />
          {t("fieldTypes.addDimension")}
        </Button>
        {valid.length ? (
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {t("fieldTypes.totalCbm", {
              value: formatNumber(calcCbm(valid), i18next.language, {
                maximumFractionDigits: 3,
              }),
            })}
          </span>
        ) : null}
      </div>
    </div>
  )
}
