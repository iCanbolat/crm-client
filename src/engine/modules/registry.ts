import { registerFieldTypes } from "../field-types/registry"
import type { ModuleId, ModuleManifest } from "./types"

const registry = new Map<ModuleId, ModuleManifest>()

/**
 * Called once by the app layer; features read modules only through here.
 * Module field types are registered up front: metadata decides where they
 * appear, and an inactive module simply has no fields using them.
 */
export function registerModules(manifests: readonly ModuleManifest[]) {
  registry.clear()
  for (const manifest of manifests) {
    registry.set(manifest.id, manifest)
    if (manifest.fieldTypes?.length) registerFieldTypes(manifest.fieldTypes)
  }
}

export function getModules(): ModuleManifest[] {
  return Array.from(registry.values())
}

export function getModule(id: string): ModuleManifest | undefined {
  return registry.get(id as ModuleId)
}

/** Manifests a workspace actually uses: activated and released. */
export function getActiveModules(activeIds: readonly string[]) {
  return getModules().filter(
    (manifest) =>
      manifest.status === "active" && activeIds.includes(manifest.id)
  )
}

export function isModuleActive(
  moduleId: string | undefined,
  activeIds: readonly string[]
) {
  if (!moduleId) return true
  return getActiveModules(activeIds).some(
    (manifest) => manifest.id === moduleId
  )
}

export function getDashboardWidgets(activeIds: readonly string[]) {
  return getActiveModules(activeIds).flatMap(
    (manifest) => manifest.dashboardWidgets ?? []
  )
}

/** Form builder blocks of the workspace's active modules (B4.2). */
export function getFormBlocks(activeIds: readonly string[]) {
  return getActiveModules(activeIds).flatMap(
    (manifest) => manifest.formBlocks ?? []
  )
}
