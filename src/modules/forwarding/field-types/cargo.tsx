import {
  BoxesIcon,
  ContainerIcon,
  PlusIcon,
  RulerIcon,
  Trash2Icon,
  WeightIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
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
  validationMessage,
  type FieldInputProps,
  type FieldTypeDefinition,
} from "@/engine/field-types"
import type { FieldDef } from "@/engine/metadata"
import i18n, { getCurrentLanguage } from "@/lib/i18n"
import { formatNumber } from "@/lib/format"
import { resolveI18nText } from "@/lib/i18n-text"

import { calcCbm, type DimensionLine } from "../lib/cargo"
import { CONTAINER_CODES, CONTAINER_TYPES } from "../lib/constants"

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

const toNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null

function parseNumber(raw: string) {
  if (raw.trim() === "") return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function numberSchema(field: FieldDef) {
  let schema = z.number()
  const { min, max } = field.validation ?? {}
  if (min !== undefined) schema = schema.min(min, validationMessage.min(min))
  if (max !== undefined) schema = schema.max(max, validationMessage.max(max))
  return schema
}

/* ------------------------------------------------- weight (kg) / volume (m³) */

function createMeasureType(
  type: string,
  unit: string,
  icon: typeof WeightIcon,
  maximumFractionDigits: number
): FieldTypeDefinition<number> {
  const format = (value: number, language: string) =>
    `${formatNumber(value, language, { maximumFractionDigits })} ${unit}`

  function MeasureInput(props: FieldInputProps<number>) {
    return (
      <InputGroup>
        <InputGroupInput
          {...inputA11yProps(props)}
          type="number"
          step="any"
          min={0}
          inputMode="decimal"
          value={props.value ?? ""}
          onChange={(event) => props.onChange(parseNumber(event.target.value))}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText>{unit}</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    )
  }

  return {
    type,
    icon,
    toZod: (field) =>
      numberSchema({ ...field, validation: { min: 0, ...field.validation } }),
    isEmpty: (value) => toNumber(value) === null,
    toComparable: toNumber,
    format: (value, { language }) => format(value, language),
    filterOperators: NUMBER_OPERATORS,
    sortable: true,
    creatable: true,
    Cell: ({ value }) => {
      const number = toNumber(value)
      return number === null ? (
        <EmptyValue />
      ) : (
        <span className="tabular-nums">
          {format(number, getCurrentLanguage())}
        </span>
      )
    },
    Input: MeasureInput,
  }
}

export const weightFieldType = createMeasureType("weight", "kg", WeightIcon, 2)
export const volumeFieldType = createMeasureType("volume", "m³", BoxesIcon, 3)

/* ---------------------------------------------------------------- container */

export interface ContainerLine {
  type: string
  count: number
}

const containerLineSchema = z.object({
  type: z.enum(CONTAINER_CODES as [string, ...string[]]),
  count: z.number().int().min(1).max(999),
})

const containersMessage = {
  error: () => i18n.t("forwarding:fieldTypes.validation.containers"),
}

export function toContainers(value: unknown): ContainerLine[] {
  const parsed = z.array(containerLineSchema).safeParse(value)
  return parsed.success ? parsed.data : []
}

export function countContainers(value: unknown) {
  return toContainers(value).reduce((sum, line) => sum + line.count, 0)
}

/** "2 × 40HC, 1 × 20DC" */
export function formatContainers(lines: readonly ContainerLine[]) {
  return lines.map((line) => `${line.count} × ${line.type}`).join(", ")
}

function ContainerInput(props: FieldInputProps<ContainerLine[]>) {
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

export const containerFieldType: FieldTypeDefinition<ContainerLine[]> = {
  type: "container",
  icon: ContainerIcon,
  toZod: () =>
    z.array(containerLineSchema, containersMessage).min(1, containersMessage),
  isEmpty: (value) => toContainers(value).length === 0,
  toComparable: (value) => countContainers(value) || null,
  format: (value) => formatContainers(value),
  filterOperators: NUMBER_OPERATORS,
  sortable: true,
  creatable: true,
  Cell: ({ value }) => {
    const lines = toContainers(value)
    return lines.length ? (
      <span className="tabular-nums">{formatContainers(lines)}</span>
    ) : (
      <EmptyValue />
    )
  },
  Input: ContainerInput,
}

/* --------------------------------------------------------------- dimensions */

const positive = z.number().positive()
const dimensionLineSchema = z.object({
  length: positive,
  width: positive,
  height: positive,
  quantity: z.number().int().positive(),
})

const dimensionsMessage = {
  error: () => i18n.t("forwarding:fieldTypes.validation.dimensions"),
}

export function toDimensions(value: unknown): DimensionLine[] {
  const parsed = z.array(dimensionLineSchema).safeParse(value)
  return parsed.success ? parsed.data : []
}

/** "2 × 120×80×100 cm" per line. */
export function formatDimensions(lines: readonly DimensionLine[]) {
  return lines
    .map(
      (line) =>
        `${line.quantity} × ${line.length}×${line.width}×${line.height} cm`
    )
    .join(", ")
}

const DIMENSION_KEYS = ["length", "width", "height", "quantity"] as const

function DimensionsInput(props: FieldInputProps<DimensionLine[]>) {
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

export const dimensionsFieldType: FieldTypeDefinition<DimensionLine[]> = {
  type: "dimensions",
  icon: RulerIcon,
  toZod: () =>
    z.array(dimensionLineSchema, dimensionsMessage).min(1, dimensionsMessage),
  isEmpty: (value) => toDimensions(value).length === 0,
  toComparable: (value) => {
    const lines = toDimensions(value)
    return lines.length ? calcCbm(lines) : null
  },
  format: (value) => formatDimensions(value),
  filterOperators: ["isEmpty", "isNotEmpty"],
  sortable: false,
  creatable: true,
  Cell: ({ value }) => {
    const lines = toDimensions(value)
    if (!lines.length) return <EmptyValue />
    return (
      <span className="tabular-nums">
        {formatDimensions(lines)} ·{" "}
        {formatNumber(calcCbm(lines), getCurrentLanguage(), {
          maximumFractionDigits: 3,
        })}{" "}
        m³
      </span>
    )
  },
  Input: DimensionsInput,
}
