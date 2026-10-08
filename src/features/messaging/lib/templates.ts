import {
  renderTemplate,
  type TemplateLanguage,
  type TemplateStatus,
  type TemplateVariableSource,
} from "@/engine/messaging"
import { getField, label, type ObjectDef } from "@/engine/metadata"
import type { Language } from "@/lib/i18n"

import type { MessageTemplate } from "../api/messaging.schemas"

export type SubmissionState = TemplateStatus | "notSubmitted"

/** Review state of a template in one language. */
export function submissionState(
  template: MessageTemplate,
  language: TemplateLanguage
): SubmissionState {
  return (
    template.submissions.find((item) => item.language === language)?.status ??
    "notSubmitted"
  )
}

export const STATUS_COLORS = {
  approved: "green",
  pending: "amber",
  rejected: "red",
  paused: "amber",
  disabled: "gray",
  notSubmitted: "gray",
} as const satisfies Record<SubmissionState, string>

export function isApproved(
  template: MessageTemplate,
  language: TemplateLanguage
) {
  return submissionState(template, language) === "approved"
}

/** Template filled with its sample values (settings preview). */
export function renderExample(
  template: MessageTemplate,
  language: TemplateLanguage
) {
  return renderTemplate(
    template.content[language],
    template.variables.map((variable) => variable.example[language])
  )
}

/** Field label of a `field` variable; `null` for other sources. */
export function sourceFieldLabel(
  source: TemplateVariableSource,
  objectDef: ObjectDef | undefined,
  language: Language
) {
  if (source.kind !== "field" || !objectDef) return null
  const field = getField(objectDef, source.field)
  return field ? label(field.label, language) : source.field
}
