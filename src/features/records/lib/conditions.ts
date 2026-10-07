import {
  formatFieldValue,
  getFieldType,
  type FieldServices,
} from "@/engine/field-types"
import {
  LIST_OPERATORS,
  UNARY_OPERATORS,
  type Condition,
  type FilterOperator,
} from "@/engine/logic"
import {
  getField,
  label,
  type FieldDef,
  type ObjectDef,
} from "@/engine/metadata"
import i18n, { type Language } from "@/lib/i18n"

/** Fields a list can be filtered by (read-only timestamps included). */
export function getFilterableFields(objectDef: ObjectDef) {
  return objectDef.fields.filter(
    (field) => getFieldType(field.type).filterOperators.length > 0
  )
}

export function getOperators(field: FieldDef): readonly FilterOperator[] {
  return getFieldType(field.type).filterOperators
}

/** Shape of the operand an operator expects. */
export type OperandKind = "none" | "list" | "range" | "single"

export function getOperandKind(op: FilterOperator): OperandKind {
  if (UNARY_OPERATORS.includes(op)) return "none"
  if (LIST_OPERATORS.includes(op)) return "list"
  if (op === "between") return "range"
  return "single"
}

export function isConditionComplete(condition: Condition) {
  const kind = getOperandKind(condition.op)
  const { value } = condition
  if (kind === "none") return true
  if (kind === "list") return Array.isArray(value) && value.length > 0
  if (kind === "range") {
    return (
      Array.isArray(value) &&
      value.some((item) => item !== null && item !== undefined && item !== "")
    )
  }
  return value !== null && value !== undefined && value !== ""
}

function formatOperand(
  field: FieldDef,
  value: unknown,
  language: Language,
  services: FieldServices
): string {
  const definition = getFieldType(field.type)
  const options = definition.getOptions?.(field, { language, services })
  const fromOptions = options?.find((item) => item.value === value)?.label
  if (fromOptions) return fromOptions

  if (field.type === "currency" || field.type === "percent") {
    return new Intl.NumberFormat(language).format(Number(value))
  }
  if (field.type === "datetime") {
    return formatFieldValue({ ...field, type: "date" }, value, { language })
  }
  return formatFieldValue(field, value, { language }) || String(value)
}

/** "Aşama: Nitelikli, Yeni" — text of a filter chip. */
export function describeCondition(
  objectDef: ObjectDef,
  condition: Condition,
  language: Language,
  services: FieldServices
) {
  const field = getField(objectDef, condition.field)
  if (!field) return condition.field
  const t = i18n.getFixedT(language, "engine")
  const name = label(field.label, language)
  const operator = t(`operators.${condition.op}`)
  const kind = getOperandKind(condition.op)

  if (kind === "none") return `${name} ${operator}`
  if (condition.label) return `${name} ${operator}: ${condition.label}`

  const values = Array.isArray(condition.value)
    ? condition.value
    : [condition.value]
  const text =
    kind === "range"
      ? values
          .map((item) =>
            item === null || item === undefined || item === ""
              ? "…"
              : formatOperand(field, item, language, services)
          )
          .join(" – ")
      : values
          .map((item) => formatOperand(field, item, language, services))
          .join(", ")
  return `${name} ${operator}: ${text}`
}
