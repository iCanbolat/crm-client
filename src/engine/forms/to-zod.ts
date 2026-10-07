import { z } from "zod"

import i18n from "@/lib/i18n"

import { fieldToZod } from "../records/metadata-to-zod"
import { isAnswerField, toEngineFieldDef } from "./kinds"
import { evaluateFormLogic, type FormLogicState } from "./logic"
import type { FormAnswers, FormContent, FormField } from "./schemas"

/** Schema of one answer; `required` already includes logic requirements. */
export function formFieldToZod(field: FormField, required: boolean) {
  if (field.type === "consent") {
    // A consent box is either accepted or, when optional, anything else.
    return required
      ? z.literal(true, {
          error: () => i18n.t("engine:validation.consent"),
        })
      : z.boolean().nullable().optional()
  }
  if (field.type === "hidden") {
    return z.string().nullable().optional()
  }
  return fieldToZod(toEngineFieldDef(field, { required }))
}

/** Field is mandatory for the visitor right now (own flag or a rule). */
export function isFieldRequired(field: FormField, logic: FormLogicState) {
  return (
    field.type !== "hidden" &&
    (!!field.required || logic.requiredFields.has(field.id))
  )
}

/**
 * Validation schema of a form for the current answers (plan B4.1): only
 * visible answer fields take part, so a required field hidden by a rule
 * never blocks the visitor. Unknown and hidden keys are stripped.
 */
export function formDefToZod(content: FormContent, answers: FormAnswers) {
  const logic = evaluateFormLogic(content, answers)
  const shape: Record<string, z.ZodType> = {}
  for (const field of content.fields) {
    if (!isAnswerField(field) || logic.hiddenFields.has(field.id)) continue
    shape[field.key] = formFieldToZod(field, isFieldRequired(field, logic))
  }
  return z.object(shape)
}

/** Answers without hidden fields and layout keys (what gets submitted). */
export function clearHiddenAnswers(
  content: FormContent,
  answers: FormAnswers
): FormAnswers {
  const logic = evaluateFormLogic(content, answers)
  const result: FormAnswers = {}
  for (const field of content.fields) {
    if (!isAnswerField(field) || logic.hiddenFields.has(field.id)) continue
    if (field.key in answers) result[field.key] = answers[field.key]
  }
  return result
}

/** Steps a visitor goes through for the current answers. */
export function getVisibleSteps(content: FormContent, answers: FormAnswers) {
  const { hiddenSteps } = evaluateFormLogic(content, answers)
  return content.steps.filter((step) => !hiddenSteps.has(step.id))
}

/** Answer keys validated when leaving a step (B4.4). */
export function getStepFieldKeys(
  content: FormContent,
  stepId: string,
  answers: FormAnswers
) {
  const { hiddenFields } = evaluateFormLogic(content, answers)
  return content.fields
    .filter(
      (field) =>
        field.stepId === stepId &&
        isAnswerField(field) &&
        !hiddenFields.has(field.id)
    )
    .map((field) => field.key)
}
