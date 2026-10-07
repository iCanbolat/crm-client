import type {
  DetailSection,
  FieldDef,
  ObjectDef,
  PipelineDef,
  SelectOption,
} from "../metadata/schemas"
import type { ModuleManifest, ObjectExtension } from "./types"

/**
 * Pure metadata merge of a module into a workspace's objects (B3.1). The
 * (mock) backend runs it on activation; it is idempotent, so running it
 * again after a reset or a second activation changes nothing.
 */

function mergeFields(
  objectDef: ObjectDef,
  moduleId: string,
  fields: readonly FieldDef[]
): FieldDef[] {
  const result = [...objectDef.fields]
  for (const field of fields) {
    const index = result.findIndex((item) => item.key === field.key)
    const tagged = { ...field, moduleId }
    if (index === -1) {
      result.push(tagged)
    } else if (result[index]!.moduleId === moduleId) {
      result[index] = tagged
    } else {
      throw new Error(
        `[engine] module "${moduleId}" cannot redefine field "${objectDef.key}.${field.key}"`
      )
    }
  }
  return result
}

function patchFields(
  fields: FieldDef[],
  patches: ObjectExtension["fieldPatches"] = {}
) {
  return fields.map((field) => {
    const patch = patches[field.key]
    return patch ? { ...field, ...patch } : field
  })
}

/** The stage select must offer exactly the pipeline's stages. */
function syncStageOptions(fields: FieldDef[], pipeline: PipelineDef) {
  return fields.map((field): FieldDef => {
    if (field.key !== pipeline.field) return field
    const options = pipeline.stages.map((stage): SelectOption => ({
      value: stage.key,
      label: stage.label,
      ...(stage.color ? { color: stage.color } : {}),
    }))
    return { ...field, options }
  })
}

function mergeSections(
  sections: readonly DetailSection[],
  additions: readonly DetailSection[]
) {
  const result = [...sections]
  for (const section of additions) {
    const index = result.findIndex((item) => item.key === section.key)
    if (index !== -1) {
      const current = result[index]!
      result[index] = {
        ...current,
        fields: unique([...current.fields, ...section.fields]),
      }
      continue
    }
    const systemIndex = result.findIndex((item) => item.key === "system")
    result.splice(systemIndex === -1 ? result.length : systemIndex, 0, section)
  }
  return result
}

const unique = <T>(items: readonly T[]) => Array.from(new Set(items))

export function applyObjectExtension(
  objectDef: ObjectDef,
  moduleId: string,
  extension: ObjectExtension
): ObjectDef {
  let fields = mergeFields(objectDef, moduleId, extension.fields ?? [])
  fields = patchFields(fields, extension.fieldPatches)
  const pipeline = extension.pipeline ?? objectDef.pipeline
  if (extension.pipeline) fields = syncStageOptions(fields, extension.pipeline)

  const { list, detail } = objectDef.layouts
  const related = [...detail.related]
  for (const item of extension.related ?? []) {
    if (
      !related.some(
        (current) =>
          current.objectKey === item.objectKey && current.field === item.field
      )
    ) {
      related.push(item)
    }
  }

  return {
    ...objectDef,
    fields,
    ...(pipeline ? { pipeline } : {}),
    layouts: {
      list: {
        ...list,
        columns: unique([...list.columns, ...(extension.columns ?? [])]),
      },
      detail: {
        ...detail,
        sections: mergeSections(detail.sections, extension.sections ?? []),
        related,
      },
    },
  }
}

/** Objects of a module, tagged with its id. */
export function getModuleObjects(manifest: ModuleManifest): ObjectDef[] {
  return (manifest.objects ?? []).map((def) => ({
    ...def,
    moduleId: manifest.id,
  }))
}

/**
 * Workspace objects after activating `manifest`: its own objects are added
 * (existing ones — possibly customized by the tenant — are kept) and core
 * objects receive the module's extensions.
 */
export function applyModuleMetadata(
  objectDefs: readonly ObjectDef[],
  manifest: ModuleManifest
): ObjectDef[] {
  const extended = objectDefs.map((def) => {
    const extension = manifest.extend?.[def.key]
    return extension ? applyObjectExtension(def, manifest.id, extension) : def
  })
  const added = getModuleObjects(manifest).filter(
    (def) => !extended.some((current) => current.key === def.key)
  )
  return [...extended, ...added]
}

/**
 * Hides what inactive modules contributed (their objects and fields), so a
 * deactivated module leaves no trace in lists, forms or detail pages.
 */
export function stripInactiveModules(
  objectDefs: readonly ObjectDef[],
  isActive: (moduleId: string) => boolean
): ObjectDef[] {
  return objectDefs
    .filter((def) => !def.moduleId || isActive(def.moduleId))
    .map((def) => {
      const fields = def.fields.filter(
        (field) => !field.moduleId || isActive(field.moduleId)
      )
      if (fields.length === def.fields.length) return def
      const keys = new Set(fields.map((field) => field.key))
      const { list, detail } = def.layouts
      return {
        ...def,
        fields,
        layouts: {
          list: {
            ...list,
            columns: list.columns.filter((key) => keys.has(key)),
          },
          detail: {
            ...detail,
            highlights: detail.highlights.filter((key) => keys.has(key)),
            sections: detail.sections
              .map((section) => ({
                ...section,
                fields: section.fields.filter((key) => keys.has(key)),
              }))
              .filter((section) => section.fields.length > 0),
          },
        },
      }
    })
}
