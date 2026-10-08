import { registerFieldTypes } from "@/engine/field-types"
import { applyModuleMetadata, type ModuleManifest } from "@/engine/modules"
import { objectRowId, type ObjectRow } from "@/features/records/mocks/factory"
import { forwardingModule } from "@/modules/forwarding"
import { healthTourismModule } from "@/modules/health-tourism"
import { visaEducationModule } from "@/modules/visa-education"

import { seedWorkspaces } from "./db/seed"

const MANIFESTS: ModuleManifest[] = [
  forwardingModule,
  visaEducationModule,
  healthTourismModule,
]

// The backend formats module values too (WhatsApp template variables, CSV).
for (const manifest of MANIFESTS) {
  if (manifest.fieldTypes?.length) registerFieldTypes(manifest.fieldTypes)
}

/** Released manifests of a workspace's modules (data part of the backend). */
export function getActiveManifests(moduleIds: readonly string[]) {
  return MANIFESTS.filter(
    (manifest) =>
      manifest.status === "active" && moduleIds.includes(manifest.id)
  )
}

/** Released modules may be activated; "coming soon" ones may not. */
export function isModuleAvailable(moduleId: string) {
  return MANIFESTS.some(
    (manifest) => manifest.id === moduleId && manifest.status === "active"
  )
}

export function getModuleManifest(moduleId: string) {
  return MANIFESTS.find((manifest) => manifest.id === moduleId)
}

/**
 * Metadata of a workspace after activating `moduleIds`: the backend side of
 * the manifest's data part (objects + extensions of core objects).
 */
export function withModuleMetadata(
  workspaceId: string,
  rows: readonly ObjectRow[],
  moduleIds: readonly string[]
): ObjectRow[] {
  let defs = rows.map((row) => row.def)
  for (const moduleId of moduleIds) {
    const manifest = getModuleManifest(moduleId)
    if (manifest?.status === "active")
      defs = applyModuleMetadata(defs, manifest)
  }
  return defs.map((def) => ({
    id: objectRowId(workspaceId, def.key),
    workspaceId,
    def,
  }))
}

/** Seed: every workspace gets the metadata of the modules it starts with. */
export function seedModuleObjects(rows: readonly ObjectRow[]): ObjectRow[] {
  return seedWorkspaces().flatMap((workspace) =>
    withModuleMetadata(
      workspace.id,
      rows.filter((row) => row.workspaceId === workspace.id),
      workspace.modules
    )
  )
}
