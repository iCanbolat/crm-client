import { foldText } from "../logic/conditions"
import type { FieldDef, ObjectDef } from "../metadata/schemas"
import { getEngineType, isAnswerField } from "./kinds"
import type { FormContent, FormField } from "./schemas"

/**
 * CRM mapping of form answers (plan B4.5): which target object fields a form
 * field may fill, which target fields must be filled, and what is wrong with
 * a mapping. The mock API runs the same checks when publishing.
 */

/** Target types an answer may fill besides its own type. */
const WIDER_TARGETS: Record<string, readonly string[]> = {
  text: ["textarea"],
  textarea: ["text"],
  email: ["text"],
  phone: ["text"],
  select: ["text"],
}

/** Hidden values are plain strings (UTM, referrer, a fixed source…). */
const HIDDEN_TARGETS = ["text", "textarea", "select"]

/** Filled by the server when a submission becomes a record. */
const SERVER_FIELDS = new Set(["ownerId"])

function isServerManaged(objectDef: ObjectDef, field: FieldDef) {
  return (
    !!field.readOnly ||
    SERVER_FIELDS.has(field.key) ||
    field.key === objectDef.pipeline?.field
  )
}

export function isMappingCompatible(field: FormField, target: FieldDef) {
  if (!isAnswerField(field) || target.readOnly) return false
  if (field.type === "hidden") return HIDDEN_TARGETS.includes(target.type)
  const answer = getEngineType(field.type)
  return (
    answer === target.type || !!WIDER_TARGETS[answer]?.includes(target.type)
  )
}

/** Target fields a form field can be mapped to. */
export function getMappableTargets(field: FormField, objectDef: ObjectDef) {
  return objectDef.fields.filter(
    (target) =>
      !isServerManaged(objectDef, target) && isMappingCompatible(field, target)
  )
}

/**
 * Target fields every submission must fill: required, not filled by the
 * server (stage, owner) and not conditional (`visibleWhen`).
 */
export function getRequiredTargets(objectDef: ObjectDef) {
  return objectDef.fields.filter(
    (target) =>
      target.required &&
      !target.visibleWhen?.length &&
      !isServerManaged(objectDef, target)
  )
}

/**
 * Mapping for unmapped answer fields whose key or label matches a free,
 * compatible target ("Otomatik eşle"). Existing entries are kept.
 */
export function suggestMapping(
  content: FormContent,
  objectDef: ObjectDef
): Record<string, string> {
  const mapping = { ...content.mapping.fields }
  const used = new Set(Object.values(mapping))
  for (const field of content.fields) {
    if (mapping[field.id] || !isAnswerField(field)) continue
    const free = getMappableTargets(field, objectDef).filter(
      (target) => !used.has(target.key)
    )
    const label = foldText(field.label.tr)
    const match =
      free.find((target) => target.key === field.key) ??
      free.find((target) => label && foldText(target.label.tr) === label) ??
      // An e-mail / phone answer fills the only e-mail / phone target.
      (["email", "phone"].includes(field.type)
        ? free.find((target) => target.type === field.type)
        : undefined)
    if (match) {
      mapping[field.id] = match.key
      used.add(match.key)
    }
  }
  return mapping
}

export type MappingIssueCode =
  | "requiredTarget"
  | "requiredTargetOptional"
  | "typeMismatch"
  | "unknownTarget"
  | "unknownField"
  | "duplicateTarget"
  | "duplicateNeedsEmail"

export interface MappingIssue {
  code: MappingIssueCode
  fieldId?: string
  /** Target field key. */
  target?: string
}

/** Problems that keep a form from creating valid records (TC-4.5-01/02). */
export function validateMapping(
  content: FormContent,
  objectDef: ObjectDef
): MappingIssue[] {
  const issues: MappingIssue[] = []
  const fields = new Map(content.fields.map((field) => [field.id, field]))
  const targets = new Map(
    objectDef.fields.map((target) => [target.key, target])
  )
  const sources = new Map<string, FormField[]>()

  for (const [fieldId, targetKey] of Object.entries(content.mapping.fields)) {
    const field = fields.get(fieldId)
    const target = targets.get(targetKey)
    if (!field || !isAnswerField(field)) {
      issues.push({ code: "unknownField", fieldId, target: targetKey })
      continue
    }
    if (!target || isServerManaged(objectDef, target)) {
      issues.push({ code: "unknownTarget", fieldId, target: targetKey })
      continue
    }
    if (!isMappingCompatible(field, target)) {
      issues.push({ code: "typeMismatch", fieldId, target: targetKey })
      continue
    }
    sources.set(targetKey, [...(sources.get(targetKey) ?? []), field])
  }

  for (const [targetKey, fed] of sources) {
    if (fed.length > 1) {
      for (const field of fed.slice(1)) {
        issues.push({
          code: "duplicateTarget",
          fieldId: field.id,
          target: targetKey,
        })
      }
    }
  }

  for (const target of getRequiredTargets(objectDef)) {
    const fed = sources.get(target.key)
    if (!fed?.length) {
      issues.push({ code: "requiredTarget", target: target.key })
    } else if (
      !fed.some((field) => field.required || field.type === "hidden")
    ) {
      issues.push({
        code: "requiredTargetOptional",
        fieldId: fed[0]!.id,
        target: target.key,
      })
    }
  }

  if (content.mapping.duplicate === "linkContactByEmail") {
    const hasEmail = [...sources.entries()].some(
      ([key, fed]) =>
        targets.get(key)?.type === "email" &&
        fed.some((field) => field.type === "email")
    )
    if (!hasEmail) issues.push({ code: "duplicateNeedsEmail" })
  }
  return issues
}
