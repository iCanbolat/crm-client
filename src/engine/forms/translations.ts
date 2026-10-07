import type { I18nText } from "@/lib/i18n-text"
import type { Language } from "@/lib/i18n"

import type { FormContent } from "./schemas"

export interface MissingTranslation {
  /** Field / step id, or `settings`. */
  scope: "field" | "step" | "settings"
  id: string
  /** `label`, `placeholder`, `options.2`, `successMessage`, … */
  property: string
  language: Language
}

/**
 * Texts written in one of the form's languages but empty in another
 * (B4.3). Only languages the form is offered in count; untouched optional
 * texts (no language filled) are not reported.
 */
export function getMissingTranslations(
  content: FormContent
): MissingTranslation[] {
  const languages = content.settings.languages
  if (languages.length < 2) return []
  const missing: MissingTranslation[] = []

  const check = (
    text: I18nText | undefined,
    scope: MissingTranslation["scope"],
    id: string,
    property: string
  ) => {
    if (!text) return
    const filled = languages.filter((language) => text[language]?.trim())
    if (filled.length === 0) return
    for (const language of languages) {
      if (!text[language]?.trim())
        missing.push({ scope, id, property, language })
    }
  }

  for (const step of content.steps) check(step.title, "step", step.id, "title")
  for (const field of content.fields) {
    if (field.type !== "divider") check(field.label, "field", field.id, "label")
    check(field.placeholder, "field", field.id, "placeholder")
    check(field.helpText, "field", field.id, "helpText")
    check(field.content, "field", field.id, "content")
    field.options?.forEach((option, index) =>
      check(option.label, "field", field.id, `options.${index}`)
    )
  }
  check(content.settings.submitLabel, "settings", "settings", "submitLabel")
  check(
    content.settings.successMessage,
    "settings",
    "settings",
    "successMessage"
  )
  return missing
}
