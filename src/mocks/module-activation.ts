import { activateForwarding } from "@/modules/forwarding/mocks/activate"

import { db } from "./db"
import { withModuleMetadata } from "./modules"

/** Data migrations a module needs beyond its metadata. */
const ACTIVATION_HOOKS: Record<string, (workspaceId: string) => void> = {
  forwarding: activateForwarding,
}

/**
 * Backend side of activating a module (onboarding or Settings): seeds its
 * objects, extends core objects and migrates existing data. Idempotent.
 */
export function activateModuleData(workspaceId: string, moduleId: string) {
  const rows = db.objects.findMany((row) => row.workspaceId === workspaceId)
  for (const row of withModuleMetadata(workspaceId, rows, [moduleId])) {
    if (db.objects.findById(row.id)) db.objects.update(row.id, { def: row.def })
    else db.objects.create(row)
  }
  ACTIVATION_HOOKS[moduleId]?.(workspaceId)
}
