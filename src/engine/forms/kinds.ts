import { getFieldType } from "../field-types/registry"
import type { FieldDef } from "../metadata/schemas"
import {
  FORM_LAYOUT_TYPES,
  type FormContent,
  type FormField,
  type FormLayoutType,
} from "./schemas"

/**
 * Form fields reuse the engine field types (validation, comparison, inputs):
 * palette types without an engine counterpart are mapped to the closest one.
 * Module block fields already use engine types (`location`, `container`, …).
 */
const ENGINE_TYPES: Record<string, string> = {
  radio: "select",
  checkboxes: "multiselect",
  consent: "boolean",
  hidden: "text",
}

export type FormFieldCategory = "input" | "hidden" | "layout"

export function isLayoutType(type: string): type is FormLayoutType {
  return (FORM_LAYOUT_TYPES as readonly string[]).includes(type)
}

export function getFormFieldCategory(type: string): FormFieldCategory {
  if (isLayoutType(type)) return "layout"
  return type === "hidden" ? "hidden" : "input"
}

/** Engine field type that validates and compares the field's answer. */
export function getEngineType(type: string) {
  return ENGINE_TYPES[type] ?? type
}

/** Fields that produce an answer (inputs and hidden fields). */
export function isAnswerField(field: FormField) {
  return getFormFieldCategory(field.type) !== "layout"
}

export function getAnswerFields(content: FormContent) {
  return content.fields.filter(isAnswerField)
}

/** Fields a visitor fills in (hidden and layout fields excluded). */
export function isInputField(field: FormField) {
  return getFormFieldCategory(field.type) === "input"
}

export function getFormField(content: FormContent, id: string) {
  return content.fields.find((field) => field.id === id)
}

export function getStepFields(content: FormContent, stepId: string) {
  return content.fields.filter((field) => field.stepId === stepId)
}

/**
 * Engine view of a form field: label/help/options/validation carried over,
 * so `getFieldType(type).toZod/Input/toComparable` work unchanged.
 */
export function toEngineFieldDef(
  field: FormField,
  { required = field.required }: { required?: boolean } = {}
): FieldDef {
  return {
    key: field.key,
    label: field.label,
    type: getEngineType(field.type),
    required,
    options: field.options,
    validation: field.validation,
    helpText: field.helpText,
  }
}

/** Engine definition of a field's answer type. */
export function getAnswerType(field: FormField) {
  return getFieldType(getEngineType(field.type))
}
