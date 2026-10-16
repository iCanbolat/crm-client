import { BoxesIcon, ContainerIcon, RulerIcon, WeightIcon } from "lucide-react"
import { z } from "zod"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import {
  EmptyValue,
  inputA11yProps,
  validationMessage,
  type FieldInputProps,
  type FieldTypeDefinition,
  lazyFieldInput,
} from "@/engine/field-types"
import type { FieldDef } from "@/engine/metadata"
import i18n, { getCurrentLanguage } from "@/lib/i18n"
import { formatNumber } from "@/lib/format"

import { calcCbm, type DimensionLine } from "../lib/cargo"
import { CONTAINER_CODES } from "../lib/constants"

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

export function parseNumber(raw: string) {
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
  Input: lazyFieldInput(() =>
    import("./inputs").then((module) => module.ContainerInput)
  ),
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
  Input: lazyFieldInput(() =>
    import("./inputs").then((module) => module.DimensionsInput)
  ),
}
