import type { CrmRecord, ObjectDef } from "../metadata/schemas"
import { getActiveModules } from "./registry"
import type { RecordSlotName, SlotDef } from "./types"

export function getSlotDefs(
  name: RecordSlotName,
  activeModuleIds: readonly string[]
): SlotDef[] {
  return getActiveModules(activeModuleIds).flatMap(
    (manifest) => manifest.recordSlots?.[name] ?? []
  )
}

interface ModuleSlotProps {
  name: RecordSlotName
  activeModuleIds: readonly string[]
  objectDef: ObjectDef
  record: CrmRecord
}

/** Renders what active modules contribute to a record page region. */
export function ModuleSlot({
  name,
  activeModuleIds,
  objectDef,
  record,
}: ModuleSlotProps) {
  const slots = getSlotDefs(name, activeModuleIds)
  if (slots.length === 0) return null

  return (
    <div data-slot-name={name} className="flex flex-col gap-4">
      {slots.map(({ id, component: Component }) => (
        <Component key={id} objectDef={objectDef} record={record} />
      ))}
    </div>
  )
}
