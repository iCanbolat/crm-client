import {
  FORM_SCHEMA_VERSION,
  type FormContent,
  type FormMapping,
  type FormSettings,
  type FormTheme,
} from "./schemas"

const t = (tr: string, en: string) => ({ tr, en })

export const DEFAULT_FORM_THEME: FormTheme = {
  logoUrl: null,
  primaryColor: "#2563eb",
  backgroundColor: "#ffffff",
  textColor: "#18181b",
  font: "default",
  radius: "md",
}

export function createDefaultSettings(): FormSettings {
  return {
    languages: ["tr", "en"],
    defaultLanguage: "tr",
    submitLabel: t("Gönder", "Submit"),
    successMessage: t(
      "Teşekkürler! Talebiniz bize ulaştı, en kısa sürede dönüş yapacağız.",
      "Thank you! We received your request and will get back to you shortly."
    ),
    redirectUrl: null,
    notifyEmails: [],
    honeypot: true,
    maxSubmissions: null,
    showProgress: true,
  }
}

export function createDefaultMapping(): FormMapping {
  return { objectKey: "lead", fields: {}, duplicate: "create", ownerId: null }
}

export const FIRST_STEP_ID = "step1"

/** Content of a form without fields (one untitled step). */
export function createEmptyContent(): FormContent {
  return {
    schemaVersion: FORM_SCHEMA_VERSION,
    steps: [{ id: FIRST_STEP_ID, title: t("", "") }],
    fields: [],
    logic: [],
    mapping: createDefaultMapping(),
    settings: createDefaultSettings(),
    theme: { ...DEFAULT_FORM_THEME },
  }
}
