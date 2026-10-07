import { z } from "zod"

/**
 * Condition evaluator shared by list filters (client + mock API), stage
 * gates and — from B4.4 on — form logic. Pure and type-agnostic: field types
 * turn raw values into comparable ones (`toComparable`) before evaluation.
 */

export const FILTER_OPERATORS = [
  "eq",
  "neq",
  "contains",
  "notContains",
  "startsWith",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "in",
  "notIn",
  "before",
  "after",
  "on",
  "isEmpty",
  "isNotEmpty",
  "isTrue",
  "isFalse",
] as const
export type FilterOperator = (typeof FILTER_OPERATORS)[number]

/** Operators that need no operand. */
export const UNARY_OPERATORS: readonly FilterOperator[] = [
  "isEmpty",
  "isNotEmpty",
  "isTrue",
  "isFalse",
]

/** Operators whose operand is a list of values. */
export const LIST_OPERATORS: readonly FilterOperator[] = ["in", "notIn"]

export const conditionSchema = z.object({
  field: z.string().min(1),
  op: z.enum(FILTER_OPERATORS),
  value: z.unknown().optional(),
  /** Display text of the operand (e.g. a related record's name). */
  label: z.string().optional(),
})
export type Condition = z.infer<typeof conditionSchema>

/** Normalized value a condition is evaluated against. */
export type Comparable = string | number | boolean | string[] | null

/**
 * Case- and diacritic-insensitive text: "ÇINAR", "çınar" and "cinar" are
 * equal, so users find Turkish names without typing special letters.
 */
export function foldText(value: unknown) {
  return String(value ?? "")
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

const normalize = foldText

function isEmptyComparable(value: Comparable) {
  return (
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  )
}

function toList(operand: unknown): string[] {
  if (Array.isArray(operand)) return operand.map((item) => String(item))
  if (operand === undefined || operand === null || operand === "") return []
  return [String(operand)]
}

function toNumber(operand: unknown) {
  const number = typeof operand === "number" ? operand : Number(operand)
  return Number.isFinite(number) ? number : null
}

function compareOrdered(value: Comparable, operand: unknown) {
  if (typeof value === "number") {
    const other = toNumber(operand)
    return other === null ? null : value - other
  }
  if (typeof value === "string") {
    const other = String(operand ?? "")
    if (!other) return null
    return value < other ? -1 : value > other ? 1 : 0
  }
  return null
}

function equals(value: Comparable, operand: unknown) {
  if (Array.isArray(value)) {
    return value.some((item) => normalize(item) === normalize(operand))
  }
  if (typeof value === "number") return value === toNumber(operand)
  if (typeof value === "boolean")
    return value === (operand === true || operand === "true")
  return normalize(value) === normalize(operand)
}

/** Date values compare on their `YYYY-MM-DD` part. */
const datePart = (value: Comparable) =>
  typeof value === "string" ? value.slice(0, 10) : null

export function evaluateOperator(
  op: FilterOperator,
  value: Comparable,
  operand?: unknown
): boolean {
  switch (op) {
    case "isEmpty":
      return isEmptyComparable(value)
    case "isNotEmpty":
      return !isEmptyComparable(value)
    case "isTrue":
      return value === true
    case "isFalse":
      return value !== true
    case "eq":
      return !isEmptyComparable(value) && equals(value, operand)
    case "neq":
      return isEmptyComparable(value) || !equals(value, operand)
    case "contains":
      return normalize(value).includes(normalize(operand))
    case "notContains":
      return !normalize(value).includes(normalize(operand))
    case "startsWith":
      return normalize(value).startsWith(normalize(operand))
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const diff = compareOrdered(value, operand)
      if (diff === null) return false
      if (op === "gt") return diff > 0
      if (op === "gte") return diff >= 0
      if (op === "lt") return diff < 0
      return diff <= 0
    }
    case "between": {
      const [from, to] = Array.isArray(operand) ? operand : []
      if (isEmptyComparable(value)) return false
      const afterFrom =
        from === undefined || from === null || from === ""
          ? true
          : (compareOrdered(value, from) ?? -1) >= 0
      const beforeTo =
        to === undefined || to === null || to === ""
          ? true
          : (compareOrdered(value, to) ?? 1) <= 0
      return afterFrom && beforeTo
    }
    case "in":
    case "notIn": {
      const list = toList(operand).map(normalize)
      const values = Array.isArray(value)
        ? value.map(normalize)
        : isEmptyComparable(value)
          ? []
          : [normalize(value)]
      const hit = values.some((item) => list.includes(item))
      return op === "in" ? hit : !hit
    }
    case "before":
    case "after":
    case "on": {
      const day = datePart(value)
      const other = typeof operand === "string" ? operand.slice(0, 10) : ""
      if (!day || !other) return false
      if (op === "on") return day === other
      return op === "before" ? day < other : day > other
    }
  }
}

/** Sorts comparables: empty values last, numbers numerically, text by locale. */
export function compareComparables(a: Comparable, b: Comparable) {
  const aEmpty = isEmptyComparable(a)
  const bEmpty = isEmptyComparable(b)
  if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1
  if (typeof a === "number" && typeof b === "number") return a - b
  if (typeof a === "boolean" && typeof b === "boolean")
    return Number(a) - Number(b)
  const left = Array.isArray(a) ? a.join(", ") : String(a)
  const right = Array.isArray(b) ? b.join(", ") : String(b)
  return left.localeCompare(right, "tr", { numeric: true, sensitivity: "base" })
}
