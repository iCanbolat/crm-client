import {
  BoxIcon,
  BuildingIcon,
  ContactIcon,
  ContainerIcon,
  FileTextIcon,
  HandCoinsIcon,
  InboxIcon,
  ReceiptIcon,
  ShipIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"
import { createElement } from "react"

import type { Language } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"

import type {
  CrmRecord,
  FieldDef,
  I18nTextValue,
  ObjectDef,
  StageDef,
} from "./schemas"

const OBJECT_ICONS: Record<string, LucideIcon> = {
  building: BuildingIcon,
  contact: ContactIcon,
  inbox: InboxIcon,
  "hand-coins": HandCoinsIcon,
  "file-text": FileTextIcon,
  ship: ShipIcon,
  receipt: ReceiptIcon,
  container: ContainerIcon,
  users: UsersIcon,
}

export function getObjectIcon(name: string): LucideIcon {
  return OBJECT_ICONS[name] ?? BoxIcon
}

/** Renders an object's icon by name (`createElement`: not a render-time component). */
export function ObjectIcon({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  return createElement(getObjectIcon(name), { className, "aria-hidden": true })
}

export function label(text: I18nTextValue, language: Language) {
  return resolveI18nText(text, language)
}

export function getField(objectDef: ObjectDef, key: string) {
  return objectDef.fields.find((field) => field.key === key)
}

/** Fields of `keys` that exist on the object, in the given order. */
export function pickFields(objectDef: ObjectDef, keys: readonly string[]) {
  return keys.flatMap((key) => {
    const field = getField(objectDef, key)
    return field ? [field] : []
  })
}

/** Fields a user may fill in (not maintained by the server). */
export function getEditableFields(objectDef: ObjectDef): FieldDef[] {
  return objectDef.fields.filter((field) => !field.readOnly)
}

/**
 * Editable fields grouped like the detail layout; fields missing from the
 * layout are appended as a trailing group so a form never hides them.
 */
export function getFormSections(objectDef: ObjectDef) {
  const editable = getEditableFields(objectDef)
  const placed = new Set<string>()
  const sections = objectDef.layouts.detail.sections.flatMap((section) => {
    const fields = pickFields(objectDef, section.fields).filter(
      (field) => !field.readOnly
    )
    fields.forEach((field) => placed.add(field.key))
    return fields.length
      ? [{ key: section.key, label: section.label, fields }]
      : []
  })
  const rest = editable.filter((field) => !placed.has(field.key))
  return rest.length
    ? [...sections, { key: "__other", label: null, fields: rest }]
    : sections
}

export function getOptionLabel(
  field: FieldDef,
  value: unknown,
  language: Language
) {
  const option = field.options?.find((item) => item.value === value)
  return option ? label(option.label, language) : String(value ?? "")
}

export function getRecordTitle(objectDef: ObjectDef, record: CrmRecord) {
  const value = record.values[objectDef.primaryField]
  return typeof value === "string" && value.trim() ? value : record.id
}

export function getStageField(objectDef: ObjectDef) {
  return objectDef.pipeline
    ? getField(objectDef, objectDef.pipeline.field)
    : undefined
}

export function getStage(
  objectDef: ObjectDef,
  stageKey: unknown
): StageDef | undefined {
  return objectDef.pipeline?.stages.find((stage) => stage.key === stageKey)
}

export function getRecordStage(objectDef: ObjectDef, record: CrmRecord) {
  return objectDef.pipeline
    ? getStage(objectDef, record.values[objectDef.pipeline.field])
    : undefined
}

/** "Yeni Alan" → "yeniAlan" (ASCII camelCase, Turkish letters folded). */
export function toFieldKey(text: string) {
  const folded = text
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
  const [first = "", ...rest] = folded.split(" ").filter(Boolean)
  const key =
    first + rest.map((part) => part[0]!.toUpperCase() + part.slice(1)).join("")
  return /^[a-z]/.test(key) ? key : key ? `f${key}` : ""
}
