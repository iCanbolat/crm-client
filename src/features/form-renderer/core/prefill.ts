import {
  isAnswerField,
  type FormAnswers,
  type FormContent,
  type FormField,
} from "@/engine/forms"

/** Where the form is shown: hidden fields read UTM / referrer from it. */
export interface FormRuntimeContext {
  /** `location.search` of the page (`?utm_source=…`). */
  search?: string
  /** `document.referrer`. */
  referrer?: string
}

/** Value of a hidden field from its source; `null` when unavailable. */
export function resolvePrefill(
  field: FormField,
  context: FormRuntimeContext = {}
): string | null {
  const prefill = field.prefill
  if (!prefill) return null
  switch (prefill.kind) {
    case "static":
      return prefill.value || null
    case "referrer":
      return context.referrer || null
    case "query": {
      if (!prefill.param) return null
      const params = new URLSearchParams(context.search ?? "")
      return params.get(prefill.param) || null
    }
  }
}

/** Starting answers: defaults, hidden values resolved, the rest empty. */
export function buildInitialAnswers(
  content: FormContent,
  context: FormRuntimeContext = {}
): FormAnswers {
  const answers: FormAnswers = {}
  for (const field of content.fields) {
    if (!isAnswerField(field)) continue
    const prefilled =
      field.type === "hidden" ? resolvePrefill(field, context) : null
    answers[field.key] = prefilled ?? field.defaultValue ?? null
  }
  return answers
}
