import type { I18nText } from "@/lib/i18n-text"

import {
  DOCUMENT_TYPE_LABELS,
  isSchengen,
  t,
  type DocumentType,
} from "./constants"

/**
 * Document checklist templates (B8.7), shared by the client and the mock
 * backend. Read-only in Faz 8: consultants add custom items per file.
 *
 * Keys: `visa:<group>:<visaCategory>` (group = SCHENGEN, GB, US, CA, AU,
 * IE or OTHER) and `edu:<country|*>:<language|undergraduate|postgraduate>`.
 */

export interface ChecklistContext {
  /** A parent / sponsor finances the stay. */
  hasSponsor?: boolean
  fieldOfStudy?: string | null
}

export interface ChecklistTemplateItem {
  key: string
  label: I18nText
  category: DocumentType
  required: boolean
  /** Documents older than this are flagged (bank statement: 30 days). */
  maxAgeDays?: number
  when?: (context: ChecklistContext) => boolean
}

const doc = (
  category: DocumentType,
  overrides: Partial<ChecklistTemplateItem> = {}
): ChecklistTemplateItem => ({
  key: category,
  label: DOCUMENT_TYPE_LABELS[category],
  category,
  required: true,
  ...overrides,
})

const sponsor = doc("sponsor_documents", { when: (ctx) => !!ctx.hasSponsor })

/* --------------------------------------------------------------- visa */

const VISA_BASE = [
  doc("passport"),
  doc("photo", { maxAgeDays: 180 }),
  doc("application_form"),
  doc("bank_statement", {
    label: t("Son 3 ay banka dökümü", "Bank statement (last 3 months)"),
    maxAgeDays: 30,
  }),
]

const SCHENGEN_INSURANCE = doc("travel_insurance", {
  label: t(
    "Seyahat sağlık sigortası (en az 30.000 €)",
    "Travel insurance (min. €30,000)"
  ),
})

const BY_CATEGORY: Record<
  string,
  (schengen: boolean) => ChecklistTemplateItem[]
> = {
  tourist_schengen: () => [
    SCHENGEN_INSURANCE,
    doc("flight_booking"),
    doc("accommodation"),
    doc("employment_letter"),
    doc("payslip", { required: false }),
    doc("civil_registry"),
    sponsor,
  ],
  tourist_other: (schengen) => [
    ...(schengen ? [SCHENGEN_INSURANCE] : []),
    doc("flight_booking", { required: false }),
    doc("accommodation", { required: false }),
    doc("employment_letter"),
    sponsor,
  ],
  business: (schengen) => [
    ...(schengen ? [SCHENGEN_INSURANCE] : []),
    doc("invitation_letter"),
    doc("employment_letter"),
    doc("tax_certificate"),
    doc("flight_booking", { required: false }),
    doc("accommodation", { required: false }),
  ],
  student: (schengen) => [
    doc("confirmation_letter"),
    doc("financial_proof"),
    doc("transcript"),
    doc("language_certificate"),
    doc("accommodation", { required: false }),
    ...(schengen ? [SCHENGEN_INSURANCE] : []),
    sponsor,
  ],
  work: (schengen) => [
    doc("employment_letter", {
      label: t("İş sözleşmesi / çalışma izni", "Job contract / work permit"),
    }),
    doc("diploma"),
    doc("cv"),
    ...(schengen ? [SCHENGEN_INSURANCE] : []),
  ],
  family_reunification: () => [
    doc("civil_registry"),
    doc("invitation_letter", {
      label: t(
        "Eşin / ailenin oturum izni",
        "Family member's residence permit"
      ),
    }),
    doc("language_certificate", {
      label: t("A1 dil belgesi", "A1 language certificate"),
      required: false,
    }),
    doc("financial_proof"),
  ],
}

/** Destination-specific extras (student route documents, fees). */
const BY_COUNTRY: Record<string, Record<string, ChecklistTemplateItem[]>> = {
  GB: {
    student: [
      doc("confirmation_letter", { label: t("CAS", "CAS") }),
      doc("medical", { label: t("Tüberküloz (TB) testi", "TB test") }),
      doc("fee_receipt", {
        label: t("IHS sağlık ücreti dekontu", "IHS payment receipt"),
      }),
    ],
  },
  US: {
    "*": [
      doc("application_form", {
        label: t("DS-160 onay sayfası", "DS-160 confirmation page"),
      }),
    ],
    student: [
      doc("confirmation_letter", { label: t("I-20", "I-20") }),
      doc("fee_receipt", {
        label: t("SEVIS I-901 ücret dekontu", "SEVIS I-901 fee receipt"),
      }),
    ],
  },
  CA: {
    student: [
      doc("confirmation_letter", {
        label: t("Kabul mektubu (LOA)", "Letter of acceptance (LOA)"),
      }),
      doc("financial_proof", {
        label: t("GIC / mali yeterlilik", "GIC / proof of funds"),
      }),
      doc("other", {
        key: "pal",
        label: t("Eyalet onay mektubu (PAL)", "Provincial attestation letter"),
      }),
    ],
  },
  AU: {
    student: [
      doc("confirmation_letter", { label: t("CoE", "CoE") }),
      doc("travel_insurance", {
        label: t("OSHC sağlık sigortası", "OSHC health cover"),
      }),
      doc("motivation_letter", {
        label: t("Genuine Student beyanı", "Genuine Student statement"),
      }),
    ],
  },
  IE: {
    student: [
      doc("financial_proof", {
        label: t("En az 10.000 € mali kanıt", "Proof of funds (min. €10,000)"),
      }),
    ],
  },
  DE: {
    student: [
      doc("confirmation_letter", { label: t("Zulassung", "Zulassung") }),
      doc("financial_proof", {
        label: t("Bloke hesap (Sperrkonto)", "Blocked account (Sperrkonto)"),
      }),
    ],
  },
}

export const VISA_GROUPS = ["SCHENGEN", "GB", "US", "CA", "AU", "IE"] as const

export function visaGroupOf(country: unknown) {
  if (country === "DE") return "DE"
  if (isSchengen(country)) return "SCHENGEN"
  return VISA_GROUPS.includes(country as never) ? String(country) : "OTHER"
}

/* ---------------------------------------------------------- education */

const CREATIVE_FIELDS = ["architecture_design", "arts_media"]

const EDU_TEMPLATES: Record<string, ChecklistTemplateItem[]> = {
  language: [
    doc("passport"),
    doc("application_form"),
    doc("fee_receipt", { required: false }),
  ],
  undergraduate: [
    doc("passport"),
    doc("transcript", {
      label: t("Lise transkripti", "High school transcript"),
    }),
    doc("diploma", { label: t("Lise diploması", "High school diploma") }),
    doc("language_certificate"),
    doc("motivation_letter"),
    doc("reference_letter"),
    doc("portfolio", {
      when: (ctx) => CREATIVE_FIELDS.includes(String(ctx.fieldOfStudy)),
    }),
  ],
  postgraduate: [
    doc("passport"),
    doc("transcript"),
    doc("diploma"),
    doc("language_certificate"),
    doc("cv"),
    doc("motivation_letter"),
    doc("reference_letter", {
      key: "reference_letter_1",
      label: t("1. referans mektubu", "Reference letter 1"),
    }),
    doc("reference_letter", {
      key: "reference_letter_2",
      label: t("2. referans mektubu", "Reference letter 2"),
    }),
    doc("portfolio", {
      when: (ctx) => CREATIVE_FIELDS.includes(String(ctx.fieldOfStudy)),
    }),
  ],
}

const EDU_COUNTRY_EXTRAS: Record<string, ChecklistTemplateItem[]> = {
  DE: [
    doc("other", {
      key: "aps",
      label: t("APS sertifikası", "APS certificate"),
    }),
  ],
  US: [
    doc("financial_proof", {
      label: t("Banka yeterlilik yazısı", "Bank letter"),
    }),
  ],
}

export function levelGroupOf(level: unknown) {
  if (level === "language_course") return "language"
  if (level === "master" || level === "phd") return "postgraduate"
  return "undergraduate"
}

/* ------------------------------------------------------------ resolve */

/** Template a record starts with (`null` when nothing fits yet). */
export function templateKeyFor(
  objectKey: string,
  values: Record<string, unknown>
): string | null {
  if (objectKey === "visaApplication") {
    const country = values.destinationCountry
    const category = values.visaCategory
    if (!country || !category) return null
    return `visa:${visaGroupOf(country)}:${String(category)}`
  }
  if (objectKey === "enrollment") {
    // Known once a programme is picked (level and country come with it).
    const level = values.studyLevel
    if (!level) return null
    const country = values.country
    return `edu:${country ? String(country) : "*"}:${levelGroupOf(level)}`
  }
  return null
}

/** Items of a template, later entries replacing earlier ones by key. */
export function buildChecklist(
  templateKey: string,
  context: ChecklistContext = {}
): ChecklistTemplateItem[] {
  const [kind, group = "", variant = ""] = templateKey.split(":")
  let items: ChecklistTemplateItem[] = []
  if (kind === "visa") {
    const schengen = group === "SCHENGEN" || group === "DE"
    items = [
      ...VISA_BASE,
      ...(BY_CATEGORY[variant]?.(schengen) ?? []),
      ...(BY_COUNTRY[group]?.["*"] ?? []),
      ...(BY_COUNTRY[group]?.[variant] ?? []),
    ]
  } else if (kind === "edu") {
    items = [
      ...(EDU_TEMPLATES[variant] ?? EDU_TEMPLATES.undergraduate!),
      ...(variant === "language" ? [] : (EDU_COUNTRY_EXTRAS[group] ?? [])),
    ]
  }
  const byKey = new Map<string, ChecklistTemplateItem>()
  for (const item of items) {
    if (item.when && !item.when(context)) continue
    byKey.set(item.key, item)
  }
  return Array.from(byKey.values())
}
