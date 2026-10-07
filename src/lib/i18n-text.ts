import type { Language } from "@/lib/i18n"

/** Inline translations carried by metadata and module manifests. */
export type I18nText = Record<Language, string>

export function resolveI18nText(text: I18nText, language: Language) {
  return text[language] || text.tr
}
