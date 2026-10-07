import { getFieldType } from "../field-types/registry"
import { getStage, pickFields } from "../metadata/helpers"
import type { FieldDef, ObjectDef, RecordValues } from "../metadata/schemas"

/**
 * Stage gate: fields the target stage requires that are still empty
 * (e.g. "lost reason" before moving a deal to "Lost"). An empty result
 * means the record may enter the stage.
 */
export function getMissingGateFields(
  objectDef: ObjectDef,
  stageKey: string,
  values: RecordValues
): FieldDef[] {
  const stage = getStage(objectDef, stageKey)
  if (!stage?.requiredFields?.length) return []

  return pickFields(objectDef, stage.requiredFields).filter((field) =>
    getFieldType(field.type).isEmpty(values[field.key])
  )
}
