import i18n from "i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import { initReactI18next } from "react-i18next"
import { z } from "zod"
import zodEn from "zod/v4/locales/en.js"
import zodTr from "zod/v4/locales/tr.js"

import {
  coreResources,
  defaultNS,
  fallbackLanguage,
  isLanguage,
  supportedLanguages,
  type Language,
} from "@/locales"

export { isLanguage, supportedLanguages, type Language }

export const LANGUAGE_STORAGE_KEY = "lang"

/** Dev-only: surfaces missing translation keys in the console. */
export function warnMissingKey(
  languages: readonly string[],
  namespace: string,
  key: string
) {
  console.warn(
    `[i18n] Missing translation "${namespace}:${key}" (${languages.join(", ")})`
  )
}

function getLanguage(lng: string | undefined): Language {
  const base = lng?.split("-")[0]
  return isLanguage(base) ? base : fallbackLanguage
}

/** Keeps <html lang> and zod's built-in validation messages in sync. */
function syncLanguage(lng: string | undefined) {
  const language = getLanguage(lng)
  document.documentElement.lang = language
  z.config(language === "en" ? zodEn() : zodTr())
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: coreResources,
    defaultNS,
    ns: Object.keys(coreResources.tr),
    fallbackLng: fallbackLanguage,
    supportedLngs: supportedLanguages,
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    initAsync: false,
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ["localStorage"],
    },
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: import.meta.env.DEV ? warnMissingKey : false,
  })

syncLanguage(i18n.resolvedLanguage)
i18n.on("languageChanged", syncLanguage)

let adminResources: Promise<void> | null = null

/**
 * Adds the admin-only namespaces (their own chunk, B7.4). The admin app, the
 * mock backend and tests await it before rendering; repeated calls share
 * one load.
 */
export function loadAdminResources() {
  adminResources ??= import("@/locales/admin").then(
    ({ adminResources: bundles }) => {
      for (const language of supportedLanguages) {
        for (const [namespace, data] of Object.entries(bundles[language])) {
          i18n.addResourceBundle(language, namespace, data, true, true)
        }
      }
    }
  )
  return adminResources
}

export function getCurrentLanguage(): Language {
  return getLanguage(i18n.resolvedLanguage ?? i18n.language)
}

export default i18n
