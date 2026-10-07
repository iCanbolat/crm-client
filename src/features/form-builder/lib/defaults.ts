import {
  createEmptyContent,
  FIRST_STEP_ID,
  newFormElementId,
  uniqueAnswerKey,
  type FormContent,
  type FormField,
  type FormPaletteType,
} from "@/engine/forms"
import type { I18nText } from "@/lib/i18n-text"

const t = (tr: string, en: string): I18nText => ({ tr, en })

const choices = () => [
  { value: "option1", label: t("Seçenek 1", "Option 1") },
  { value: "option2", label: t("Seçenek 2", "Option 2") },
]

type FieldDefaults = Omit<FormField, "id" | "stepId" | "key"> & { key: string }

/**
 * What a palette item inserts (B4.2). Defaults are stored content, so they
 * carry both languages inline like metadata labels do.
 */
export const PALETTE_DEFAULTS: Record<FormPaletteType, () => FieldDefaults> = {
  text: () => ({
    key: "text",
    type: "text",
    label: t("Kısa metin", "Short text"),
    width: "full",
  }),
  textarea: () => ({
    key: "message",
    type: "textarea",
    label: t("Mesajınız", "Your message"),
    width: "full",
  }),
  email: () => ({
    key: "email",
    type: "email",
    label: t("E-posta", "Email"),
    width: "half",
  }),
  phone: () => ({
    key: "phone",
    type: "phone",
    label: t("Telefon", "Phone"),
    width: "half",
  }),
  number: () => ({
    key: "number",
    type: "number",
    label: t("Sayı", "Number"),
    width: "half",
  }),
  select: () => ({
    key: "choice",
    type: "select",
    label: t("Seçim", "Choice"),
    width: "full",
    options: choices(),
  }),
  radio: () => ({
    key: "option",
    type: "radio",
    label: t("Tek seçim", "Single choice"),
    width: "full",
    options: choices(),
  }),
  checkboxes: () => ({
    key: "options",
    type: "checkboxes",
    label: t("Çoklu seçim", "Multiple choice"),
    width: "full",
    options: choices(),
  }),
  date: () => ({
    key: "date",
    type: "date",
    label: t("Tarih", "Date"),
    width: "half",
  }),
  file: () => ({
    key: "attachment",
    type: "file",
    label: t("Dosya", "File"),
    width: "full",
  }),
  consent: () => ({
    key: "consent",
    type: "consent",
    label: t(
      "Kişisel verilerimin KVKK kapsamında işlenmesini kabul ediyorum.",
      "I agree to the processing of my personal data (GDPR)."
    ),
    required: true,
    width: "full",
  }),
  hidden: () => ({
    key: "hidden",
    type: "hidden",
    label: t("Gizli alan", "Hidden field"),
    width: "full",
    prefill: { kind: "static", value: "" },
  }),
  heading: () => ({
    key: "heading",
    type: "heading",
    label: t("Başlık", "Heading"),
    width: "full",
  }),
  paragraph: () => ({
    key: "paragraph",
    type: "paragraph",
    label: t("Paragraf", "Paragraph"),
    content: t("Açıklama metni", "Description text"),
    width: "full",
  }),
  divider: () => ({
    key: "divider",
    type: "divider",
    label: t("Ayırıcı", "Divider"),
    width: "full",
  }),
}

/** New field of a palette type with a unique key. */
export function createPaletteField(
  type: FormPaletteType,
  {
    stepId,
    takenKeys,
    createId = () => newFormElementId("fld"),
  }: {
    stepId: string
    takenKeys: ReadonlySet<string>
    createId?: () => string
  }
): FormField {
  const { key, ...rest } = PALETTE_DEFAULTS[type]()
  return {
    ...rest,
    id: createId(),
    key: uniqueAnswerKey(key, takenKeys),
    stepId,
  }
}

/** UTM parameters and the referrer as hidden fields (B4.5). */
export const TRACKING_FIELDS: {
  key: string
  param?: string
  label: I18nText
}[] = [
  {
    key: "utmSource",
    param: "utm_source",
    label: t("UTM kaynağı", "UTM source"),
  },
  {
    key: "utmMedium",
    param: "utm_medium",
    label: t("UTM ortamı", "UTM medium"),
  },
  {
    key: "utmCampaign",
    param: "utm_campaign",
    label: t("UTM kampanyası", "UTM campaign"),
  },
  { key: "utmTerm", param: "utm_term", label: t("UTM terimi", "UTM term") },
  {
    key: "utmContent",
    param: "utm_content",
    label: t("UTM içeriği", "UTM content"),
  },
  { key: "referrer", label: t("Yönlendiren sayfa", "Referrer") },
]

const starterField = (
  key: string,
  type: string,
  label: I18nText,
  extra: Partial<FormField> = {}
): FormField => ({
  id: `fld_${key}`,
  key,
  type,
  stepId: FIRST_STEP_ID,
  label,
  width: "full",
  ...extra,
})

/**
 * Content of a new form: the contact fields every lead form needs, already
 * mapped to the lead (B4.2), and a consent box.
 */
export function createStarterContent(): FormContent {
  const content = createEmptyContent()
  content.fields = [
    starterField("name", "text", t("Ad soyad", "Full name"), {
      required: true,
      width: "half",
    }),
    starterField("companyName", "text", t("Firma adı", "Company"), {
      width: "half",
    }),
    starterField("email", "email", t("E-posta", "Email"), {
      required: true,
      width: "half",
      placeholder: t("ornek@firma.com", "name@company.com"),
    }),
    starterField("phone", "phone", t("Telefon", "Phone"), { width: "half" }),
    starterField("message", "textarea", t("Mesajınız", "Your message")),
    starterField("consent", "consent", PALETTE_DEFAULTS.consent().label, {
      required: true,
    }),
  ]
  content.mapping.fields = {
    fld_name: "name",
    fld_companyName: "companyName",
    fld_email: "email",
    fld_phone: "phone",
    fld_message: "message",
  }
  return content
}
