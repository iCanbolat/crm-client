import type { FieldDef, FieldType } from "../metadata/schemas"
import {
  booleanFieldType,
  multiselectFieldType,
  selectFieldType,
} from "./core/choice"
import { countryFieldType, phoneFieldType } from "./core/contact"
import { dateFieldType, datetimeFieldType } from "./core/date"
import { fileFieldType, unknownFieldType } from "./core/file"
import {
  currencyFieldType,
  numberFieldType,
  percentFieldType,
} from "./core/number"
import { relationFieldType, userFieldType } from "./core/reference"
import {
  emailFieldType,
  textareaFieldType,
  textFieldType,
  urlFieldType,
} from "./core/text"
import type { AnyFieldTypeDefinition, FormatContext } from "./types"

export const CORE_FIELD_TYPE_DEFINITIONS: AnyFieldTypeDefinition[] = [
  textFieldType,
  textareaFieldType,
  numberFieldType,
  currencyFieldType,
  percentFieldType,
  dateFieldType,
  datetimeFieldType,
  booleanFieldType,
  selectFieldType,
  multiselectFieldType,
  emailFieldType,
  phoneFieldType,
  urlFieldType,
  countryFieldType,
  userFieldType,
  relationFieldType,
  fileFieldType,
]

const registry = new Map<string, AnyFieldTypeDefinition>(
  CORE_FIELD_TYPE_DEFINITIONS.map((definition) => [definition.type, definition])
)

/** Sector modules add their own types (B3.2); core types cannot be replaced. */
export function registerFieldTypes(definitions: AnyFieldTypeDefinition[]) {
  for (const definition of definitions) {
    if (
      CORE_FIELD_TYPE_DEFINITIONS.some((core) => core.type === definition.type)
    ) {
      throw new Error(`[engine] field type "${definition.type}" is reserved`)
    }
    registry.set(definition.type, definition)
  }
}

export function hasFieldType(type: FieldType) {
  return registry.has(type)
}

/** Never throws: unknown types get a safe read-only fallback (TC-2.1-21). */
export function getFieldType(type: FieldType): AnyFieldTypeDefinition {
  return registry.get(type) ?? unknownFieldType
}

export function getFieldTypes() {
  return Array.from(registry.values())
}

export function formatFieldValue(
  field: FieldDef,
  value: unknown,
  context: Omit<FormatContext, "field">
): string {
  const definition = getFieldType(field.type)
  if (definition.isEmpty(value)) return ""
  return definition.format(value, { ...context, field })
}
