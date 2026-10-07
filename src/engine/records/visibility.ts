import type { FieldDef, ObjectDef, RecordValues } from "../metadata/schemas"
import { matchesConditions } from "./query"

/**
 * Conditional fields (`visibleWhen`, B3.3): a field is shown, validated and
 * stored only while its conditions hold for the record's current values.
 */
export function isFieldVisible(
  objectDef: ObjectDef,
  field: FieldDef,
  values: RecordValues
) {
  return (
    !field.visibleWhen?.length ||
    matchesConditions(objectDef, values, field.visibleWhen)
  )
}

/** Values with every hidden conditional field cleared (`null`). */
export function clearHiddenFields(
  objectDef: ObjectDef,
  values: RecordValues
): RecordValues {
  let result = values
  for (const field of objectDef.fields) {
    if (!field.visibleWhen?.length) continue
    const value = result[field.key]
    if (value === null || value === undefined) continue
    if (isFieldVisible(objectDef, field, result)) continue
    result = { ...result, [field.key]: null }
  }
  return result
}
