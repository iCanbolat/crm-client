import { z } from "zod"

import type { Language } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"

import { isBlank } from "../field-types/core/shared"
import type { ObjectDef, RecordValues } from "../metadata/schemas"
import { getFormField, isAnswerField } from "./kinds"
import { isMappingCompatible } from "./mapping"
import type { FormAnswers, FormContent, FormField } from "./schemas"
import { clearHiddenAnswers, formDefToZod } from "./to-zod"

/**
 * Server side of a submission (plan B5.5): the mock API (and later the
 * backend) validates the answers with the very schema the renderer used and
 * turns them into record values through the form's CRM mapping.
 */

export type SubmissionValidation =
  | { ok: true; answers: FormAnswers }
  | { ok: false; fieldErrors: Record<string, string[]> }

/** Visible answers only, validated like the renderer validated them. */
export function validateSubmission(
  content: FormContent,
  answers: FormAnswers
): SubmissionValidation {
  const visible = clearHiddenAnswers(content, answers)
  const parsed = formDefToZod(content, visible).safeParse(visible)
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
        string,
        string[]
      >,
    }
  }
  return { ok: true, answers: parsed.data as FormAnswers }
}

export interface MappedSubmission {
  values: RecordValues
  /** Answer keys whose value could not be stored on the target field. */
  unmapped: string[]
}

const optionLabel = (field: FormField, value: unknown, language: Language) => {
  const option = field.options?.find((item) => item.value === value)
  return option ? resolveI18nText(option.label, language) : String(value)
}

/** Converts one answer to the target field's value; `undefined` = dropped. */
function convertAnswer(
  field: FormField,
  target: ObjectDef["fields"][number],
  value: unknown,
  language: Language
): unknown {
  const knows = (option: unknown) =>
    !target.options?.length ||
    target.options.some((item) => item.value === option)

  switch (target.type) {
    case "select":
      return knows(value) ? value : undefined
    case "multiselect": {
      const values = (Array.isArray(value) ? value : [value]).filter(knows)
      return values.length ? values : undefined
    }
    case "boolean":
      return value === true
    case "text":
    case "textarea":
      // A choice lands as its label: the target has no such options.
      if (field.type === "select" || field.type === "radio") {
        return optionLabel(field, value, language)
      }
      return typeof value === "string" ? value : String(value)
    default:
      return value
  }
}

/**
 * Record values of a submission (`mapping.fields`: form field id → target
 * field key). Blank answers are skipped; values a target cannot hold (an
 * unknown option, a removed field) are reported in `unmapped`.
 */
export function applyMapping(
  content: FormContent,
  objectDef: ObjectDef,
  answers: FormAnswers,
  language: Language = content.settings.defaultLanguage
): MappedSubmission {
  const visible = clearHiddenAnswers(content, answers)
  const values: RecordValues = {}
  const unmapped: string[] = []

  for (const [fieldId, targetKey] of Object.entries(content.mapping.fields)) {
    const field = getFormField(content, fieldId)
    if (!field || !isAnswerField(field)) continue
    const value = visible[field.key]
    if (isBlank(value) || (Array.isArray(value) && value.length === 0)) {
      continue
    }
    const target = objectDef.fields.find((item) => item.key === targetKey)
    if (!target || !isMappingCompatible(field, target)) {
      unmapped.push(field.key)
      continue
    }
    const converted = convertAnswer(field, target, value, language)
    if (converted === undefined) unmapped.push(field.key)
    else values[target.key] = converted
  }

  return { values, unmapped }
}
