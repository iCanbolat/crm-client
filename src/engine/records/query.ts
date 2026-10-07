import {
  compareComparables,
  evaluateOperator,
  foldText,
  type Condition,
} from "../logic/conditions"
import { getFieldType } from "../field-types/registry"
import { getField } from "../metadata/helpers"
import type { ObjectDef, RecordValues, SortDef } from "../metadata/schemas"

/**
 * Pure list query over record values — the mock API runs it server side,
 * exactly as a real backend would apply the same metadata rules.
 */

export function matchesSearch(
  objectDef: ObjectDef,
  values: RecordValues,
  q: string | undefined
) {
  const needle = foldText(q)
  if (!needle) return true
  const fields = objectDef.searchFields?.length
    ? objectDef.searchFields
    : [objectDef.primaryField]
  return fields.some((key) => foldText(values[key]).includes(needle))
}

export function matchesConditions(
  objectDef: ObjectDef,
  values: RecordValues,
  conditions: readonly Condition[]
) {
  return conditions.every((condition) => {
    const field = getField(objectDef, condition.field)
    // Unknown fields (e.g. a deleted custom field in a saved view) are ignored.
    if (!field) return true
    const comparable = getFieldType(field.type).toComparable(
      values[condition.field]
    )
    return evaluateOperator(condition.op, comparable, condition.value)
  })
}

export function compareRecords(
  objectDef: ObjectDef,
  sort: SortDef
): (a: RecordValues, b: RecordValues) => number {
  const field = getField(objectDef, sort.field)
  const definition = field ? getFieldType(field.type) : undefined
  const factor = sort.direction === "desc" ? -1 : 1

  return (a, b) => {
    if (!definition) return 0
    const left = definition.toComparable(a[sort.field])
    const right = definition.toComparable(b[sort.field])
    const result = compareComparables(left, right)
    // Empty values stay last in both directions.
    const leftEmpty = left === null
    const rightEmpty = right === null
    if (leftEmpty || rightEmpty) return result
    return factor * result
  }
}

export interface RecordQuery {
  q?: string
  filters?: readonly Condition[]
  sort?: SortDef
}

export function queryRecordValues<T extends { values: RecordValues }>(
  objectDef: ObjectDef,
  records: readonly T[],
  { q, filters = [], sort }: RecordQuery
): T[] {
  const matched = records.filter(
    (record) =>
      matchesSearch(objectDef, record.values, q) &&
      matchesConditions(objectDef, record.values, filters)
  )
  if (!sort) return matched
  const compare = compareRecords(objectDef, sort)
  return [...matched].sort((a, b) => compare(a.values, b.values))
}
