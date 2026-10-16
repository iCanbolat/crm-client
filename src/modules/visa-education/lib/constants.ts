import type { OptionColor, SelectOption } from "@/engine/metadata"
import type { I18nText } from "@/lib/i18n-text"

/**
 * Visa & education vocabulary shared by metadata (select options),
 * calculations, UI and the mock backend. Labels are inline translations
 * like metadata (Faz 8).
 */

export const t = (tr: string, en: string): I18nText => ({ tr, en })

export const option = (
  value: string,
  label: I18nText,
  color?: OptionColor
): SelectOption => ({ value, label, ...(color ? { color } : {}) })

type Labels<K extends string> = Record<K, I18nText>

const toOptions = <K extends string>(
  keys: readonly K[],
  labels: Labels<K>,
  colors?: Partial<Record<K, OptionColor>>
) => keys.map((key) => option(key, labels[key], colors?.[key]))

/* ------------------------------------------------------------- countries */

/** Schengen area members (visa rules and checklist group). */
export const SCHENGEN_COUNTRIES = [
  "AT",
  "BE",
  "BG",
  "CH",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GR",
  "HR",
  "HU",
  "IS",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
] as const

export function isSchengen(country: unknown) {
  return SCHENGEN_COUNTRIES.includes(
    country as (typeof SCHENGEN_COUNTRIES)[number]
  )
}

/** Countries offered as study / visa destinations. */
export const DESTINATION_COUNTRIES = [
  "GB",
  "US",
  "CA",
  "AU",
  "NZ",
  "IE",
  "DE",
  "NL",
  "FR",
  "IT",
  "ES",
  "AT",
  "CH",
  "PL",
  "HU",
  "CZ",
  "MT",
  "SE",
  "DK",
  "FI",
  "BE",
  "PT",
  "GR",
  "AE",
] as const

/* --------------------------------------------------------- service type */

export const SERVICE_TYPES = ["education", "visa", "both"] as const
export type ServiceType = (typeof SERVICE_TYPES)[number]

export const SERVICE_TYPE_LABELS: Labels<ServiceType> = {
  education: t("Yurtdışı eğitim", "Study abroad"),
  visa: t("Vize danışmanlığı", "Visa consultancy"),
  both: t("Eğitim + vize", "Study + visa"),
}

export const SERVICE_TYPE_OPTIONS = toOptions(
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  { education: "blue", visa: "violet", both: "teal" }
)

/* ---------------------------------------------------------- study level */

export const STUDY_LEVELS = [
  "language_course",
  "high_school",
  "foundation",
  "associate",
  "bachelor",
  "master",
  "phd",
  "certificate",
] as const
export type StudyLevel = (typeof STUDY_LEVELS)[number]

export const STUDY_LEVEL_LABELS: Labels<StudyLevel> = {
  language_course: t("Dil okulu", "Language course"),
  high_school: t("Lise", "High school"),
  foundation: t("Hazırlık / foundation", "Foundation"),
  associate: t("Ön lisans", "Associate degree"),
  bachelor: t("Lisans", "Bachelor's"),
  master: t("Yüksek lisans", "Master's"),
  phd: t("Doktora", "PhD"),
  certificate: t("Sertifika / diploma", "Certificate / diploma"),
}

export const STUDY_LEVEL_OPTIONS = toOptions(STUDY_LEVELS, STUDY_LEVEL_LABELS)

/* ------------------------------------------------------- field of study */

export const FIELDS_OF_STUDY = [
  "business",
  "computer_science",
  "data_science",
  "engineering",
  "medicine_health",
  "law",
  "economics_finance",
  "architecture_design",
  "arts_media",
  "education",
  "social_sciences",
  "natural_sciences",
  "hospitality_tourism",
  "psychology",
  "language",
  "other",
] as const
export type FieldOfStudy = (typeof FIELDS_OF_STUDY)[number]

export const FIELD_OF_STUDY_LABELS: Labels<FieldOfStudy> = {
  business: t("İşletme / yönetim", "Business & management"),
  computer_science: t("Bilgisayar bilimleri", "Computer science"),
  data_science: t("Veri bilimi / yapay zekâ", "Data science & AI"),
  engineering: t("Mühendislik", "Engineering"),
  medicine_health: t("Tıp / sağlık bilimleri", "Medicine & health"),
  law: t("Hukuk", "Law"),
  economics_finance: t("Ekonomi / finans", "Economics & finance"),
  architecture_design: t("Mimarlık / tasarım", "Architecture & design"),
  arts_media: t("Sanat / medya", "Arts & media"),
  education: t("Eğitim bilimleri", "Education"),
  social_sciences: t("Sosyal bilimler", "Social sciences"),
  natural_sciences: t("Fen bilimleri", "Natural sciences"),
  hospitality_tourism: t("Otelcilik / turizm", "Hospitality & tourism"),
  psychology: t("Psikoloji", "Psychology"),
  language: t("Dil eğitimi", "Language studies"),
  other: t("Diğer", "Other"),
}

export const FIELD_OF_STUDY_OPTIONS = toOptions(
  FIELDS_OF_STUDY,
  FIELD_OF_STUDY_LABELS
)

/* -------------------------------------------------------- visa category */

export const VISA_CATEGORIES = [
  "tourist_schengen",
  "tourist_other",
  "business",
  "student",
  "work",
  "family_reunification",
] as const
export type VisaCategory = (typeof VISA_CATEGORIES)[number]

export const VISA_CATEGORY_LABELS: Labels<VisaCategory> = {
  tourist_schengen: t("Turistik (Schengen)", "Tourist (Schengen)"),
  tourist_other: t("Turistik (diğer)", "Tourist (other)"),
  business: t("Ticari / iş seyahati", "Business"),
  student: t("Öğrenci", "Student"),
  work: t("Çalışma", "Work"),
  family_reunification: t("Aile birleşimi", "Family reunification"),
}

export const VISA_CATEGORY_OPTIONS = toOptions(
  VISA_CATEGORIES,
  VISA_CATEGORY_LABELS,
  {
    tourist_schengen: "blue",
    tourist_other: "teal",
    business: "gray",
    student: "violet",
    work: "amber",
    family_reunification: "green",
  }
)

export const VISA_ENTRY_OPTIONS = [
  option("single", t("Tek giriş", "Single entry")),
  option("multiple", t("Çok giriş", "Multiple entry")),
]

/* ---------------------------------------------------------- person role */

export const PERSON_ROLES = ["applicant", "parent_sponsor"] as const

export const PERSON_ROLE_OPTIONS = toOptions(
  PERSON_ROLES,
  {
    applicant: t("Başvuran", "Applicant"),
    parent_sponsor: t("Veli / sponsor", "Parent / sponsor"),
  },
  { applicant: "blue", parent_sponsor: "gray" }
)

export const APPLICANT_FILTERS = [
  { field: "personRoles", op: "in" as const, value: ["applicant"] },
]

/* ---------------------------------------------------------- institution */

export const INSTITUTION_TYPES = [
  "university",
  "college",
  "language_school",
  "high_school",
  "pathway",
] as const

export const INSTITUTION_TYPE_OPTIONS = toOptions(INSTITUTION_TYPES, {
  university: t("Üniversite", "University"),
  college: t("Kolej / uygulamalı bilimler", "College"),
  language_school: t("Dil okulu", "Language school"),
  high_school: t("Lise", "High school"),
  pathway: t("Pathway / hazırlık", "Pathway provider"),
})

export const PARTNER_STATUSES = ["direct", "via_aggregator", "none"] as const

export const PARTNER_STATUS_OPTIONS = toOptions(
  PARTNER_STATUSES,
  {
    direct: t("Doğrudan anlaşmalı", "Direct partner"),
    via_aggregator: t("Aracı üzerinden", "Via aggregator"),
    none: t("Anlaşma yok", "No agreement"),
  },
  { direct: "green", via_aggregator: "blue", none: "gray" }
)

export const COMMISSION_BASES = [
  "first_year_tuition",
  "full_tuition",
  "flat",
] as const
export type CommissionBasis = (typeof COMMISSION_BASES)[number]

export const COMMISSION_BASIS_OPTIONS = toOptions(COMMISSION_BASES, {
  first_year_tuition: t("İlk yıl öğrenim ücreti", "First-year tuition"),
  full_tuition: t("Toplam öğrenim ücreti", "Full tuition"),
  flat: t("Sabit tutar", "Flat fee"),
})

export const COMMISSION_STATUSES = [
  "none",
  "expected",
  "claimed",
  "received",
] as const
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number]

export const COMMISSION_STATUS_OPTIONS = toOptions(
  COMMISSION_STATUSES,
  {
    none: t("Yok", "None"),
    expected: t("Bekleniyor", "Expected"),
    claimed: t("Talep edildi", "Claimed"),
    received: t("Tahsil edildi", "Received"),
  },
  { none: "gray", expected: "amber", claimed: "blue", received: "green" }
)

/* -------------------------------------------------------------- intakes */

export const INTAKE_MONTHS = [1, 2, 4, 5, 6, 7, 9, 10] as const

export const MONTH_LABELS: I18nText[] = [
  t("Ocak", "January"),
  t("Şubat", "February"),
  t("Mart", "March"),
  t("Nisan", "April"),
  t("Mayıs", "May"),
  t("Haziran", "June"),
  t("Temmuz", "July"),
  t("Ağustos", "August"),
  t("Eylül", "September"),
  t("Ekim", "October"),
  t("Kasım", "November"),
  t("Aralık", "December"),
]

export const INTAKE_MONTH_OPTIONS = INTAKE_MONTHS.map((month) =>
  option(String(month), MONTH_LABELS[month - 1]!)
)

/* ----------------------------------------------------------------- CEFR */

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const
export type CefrLevel = (typeof CEFR_LEVELS)[number]

export const CEFR_OPTIONS = CEFR_LEVELS.map((level) =>
  option(level, t(level, level))
)

export const TEACHING_LANGUAGE_OPTIONS = [
  option("en", t("İngilizce", "English")),
  option("de", t("Almanca", "German")),
  option("fr", t("Fransızca", "French")),
  option("it", t("İtalyanca", "Italian")),
  option("es", t("İspanyolca", "Spanish")),
  option("nl", t("Felemenkçe", "Dutch")),
  option("pl", t("Lehçe", "Polish")),
]

/* ------------------------------------------------- enrollment pipeline */

export const ENROLLMENT_STAGES = [
  "counselling",
  "documents",
  "applied",
  "conditional_offer",
  "unconditional_offer",
  "confirmation",
  "enrolled",
  "rejected",
  "withdrawn",
] as const
export type EnrollmentStage = (typeof ENROLLMENT_STAGES)[number]

/** Stages a student visa may be started from. */
export const VISA_READY_ENROLLMENT_STAGES: readonly EnrollmentStage[] = [
  "confirmation",
  "enrolled",
]

/** Stages that count as an accepted offer (conditional or better). */
export const OFFER_STAGES: readonly EnrollmentStage[] = [
  "conditional_offer",
  "unconditional_offer",
  "confirmation",
  "enrolled",
]

export const CONFIRMATION_DOC_TYPES = [
  "CAS",
  "I20",
  "COE",
  "LOA",
  "ZULASSUNG",
  "OTHER",
] as const
export type ConfirmationDocType = (typeof CONFIRMATION_DOC_TYPES)[number]

export const CONFIRMATION_DOC_OPTIONS = toOptions(CONFIRMATION_DOC_TYPES, {
  CAS: t("CAS (Birleşik Krallık)", "CAS (UK)"),
  I20: t("I-20 (ABD)", "I-20 (US)"),
  COE: t("CoE (Avustralya)", "CoE (Australia)"),
  LOA: t("LOA (Kanada)", "LOA (Canada)"),
  ZULASSUNG: t("Zulassung (Almanya)", "Zulassung (Germany)"),
  OTHER: t("Diğer kabul belgesi", "Other confirmation"),
})

/** Confirmation document a destination usually issues. */
export function defaultConfirmationDoc(country: unknown): ConfirmationDocType {
  switch (country) {
    case "GB":
      return "CAS"
    case "US":
      return "I20"
    case "AU":
      return "COE"
    case "CA":
      return "LOA"
    case "DE":
      return "ZULASSUNG"
    default:
      return "OTHER"
  }
}

export const ENROLLMENT_REJECTION_OPTIONS = [
  option("academic", t("Akademik yeterlilik", "Academic requirements")),
  option("language", t("Dil yeterliliği", "Language requirements")),
  option("documents", t("Eksik / hatalı belge", "Documents")),
  option("capacity", t("Kontenjan doldu", "Programme full")),
  option("deadline", t("Son tarih kaçtı", "Missed deadline")),
  option("other", t("Diğer", "Other")),
]

export const WITHDRAW_REASON_OPTIONS = [
  option("budget", t("Bütçe", "Budget")),
  option("other_school", t("Başka okul tercih edildi", "Chose another school")),
  option("competitor", t("Başka danışmanlık", "Another agency")),
  option("postponed", t("Erteledi", "Postponed")),
  option("visa_risk", t("Vize riski", "Visa risk")),
  option("personal", t("Kişisel nedenler", "Personal reasons")),
  option("other", t("Diğer", "Other")),
]

/* ------------------------------------------------------- visa pipeline */

export const VISA_STAGES = [
  "consultation",
  "documents",
  "appointment_booked",
  "submitted",
  "processing",
  "approved",
  "refused",
  "cancelled",
] as const
export type VisaStage = (typeof VISA_STAGES)[number]

export const VISA_REFUSAL_OPTIONS = [
  option("insufficient_funds", t("Yetersiz mali durum", "Insufficient funds")),
  option("purpose_unclear", t("Seyahat amacı belirsiz", "Purpose unclear")),
  option("weak_ties", t("Yetersiz bağlar", "Weak ties to home")),
  option("documents", t("Eksik / güvenilmez belge", "Documents")),
  option("previous_violation", t("Önceki ihlal", "Previous violation")),
  option("other", t("Diğer", "Other")),
]

/* --------------------------------------------------------- appointments */

export const APPOINTMENT_PROVIDERS = [
  "VFS_GLOBAL",
  "IDATA",
  "TLSCONTACT",
  "BLS",
  "CONSULATE",
  "EMBASSY",
] as const
export type AppointmentProvider = (typeof APPOINTMENT_PROVIDERS)[number]

export const APPOINTMENT_PROVIDER_LABELS: Labels<AppointmentProvider> = {
  VFS_GLOBAL: t("VFS Global", "VFS Global"),
  IDATA: t("iDATA", "iDATA"),
  TLSCONTACT: t("TLScontact", "TLScontact"),
  BLS: t("BLS International", "BLS International"),
  CONSULATE: t("Konsolosluk", "Consulate"),
  EMBASSY: t("Büyükelçilik", "Embassy"),
}

export const APPOINTMENT_PROVIDER_OPTIONS = toOptions(
  APPOINTMENT_PROVIDERS,
  APPOINTMENT_PROVIDER_LABELS
)

export const APPOINTMENT_CITIES = [
  "istanbul",
  "ankara",
  "izmir",
  "antalya",
  "bursa",
  "gaziantep",
  "trabzon",
] as const
export type AppointmentCity = (typeof APPOINTMENT_CITIES)[number]

export const APPOINTMENT_CITY_LABELS: Labels<AppointmentCity> = {
  istanbul: t("İstanbul", "Istanbul"),
  ankara: t("Ankara", "Ankara"),
  izmir: t("İzmir", "Izmir"),
  antalya: t("Antalya", "Antalya"),
  bursa: t("Bursa", "Bursa"),
  gaziantep: t("Gaziantep", "Gaziantep"),
  trabzon: t("Trabzon", "Trabzon"),
}

export const APPOINTMENT_CITY_OPTIONS = toOptions(
  APPOINTMENT_CITIES,
  APPOINTMENT_CITY_LABELS
)

export const APPOINTMENT_KINDS = [
  "biometrics",
  "submission",
  "interview",
  "passport_collection",
] as const

export const APPOINTMENT_KIND_OPTIONS = toOptions(APPOINTMENT_KINDS, {
  biometrics: t("Biyometri", "Biometrics"),
  submission: t("Dosya teslimi", "Document submission"),
  interview: t("Mülakat", "Interview"),
  passport_collection: t("Pasaport teslim alma", "Passport collection"),
})

export const APPOINTMENT_STATUSES = [
  "scheduled",
  "attended",
  "no_show",
  "rescheduled",
  "cancelled",
] as const
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

export const APPOINTMENT_STATUS_OPTIONS = toOptions(
  APPOINTMENT_STATUSES,
  {
    scheduled: t("Planlandı", "Scheduled"),
    attended: t("Gidildi", "Attended"),
    no_show: t("Gidilmedi", "No-show"),
    rescheduled: t("Ertelendi", "Rescheduled"),
    cancelled: t("İptal", "Cancelled"),
  },
  {
    scheduled: "blue",
    attended: "green",
    no_show: "red",
    rescheduled: "amber",
    cancelled: "gray",
  }
)

/* ------------------------------------------------------------ documents */

export const DOCUMENT_TYPES = [
  "passport",
  "photo",
  "application_form",
  "travel_insurance",
  "flight_booking",
  "accommodation",
  "bank_statement",
  "employment_letter",
  "payslip",
  "tax_certificate",
  "student_certificate",
  "civil_registry",
  "sponsor_documents",
  "invitation_letter",
  "transcript",
  "diploma",
  "language_certificate",
  "cv",
  "motivation_letter",
  "reference_letter",
  "portfolio",
  "offer_letter",
  "confirmation_letter",
  "financial_proof",
  "medical",
  "fee_receipt",
  "other",
] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export const DOCUMENT_TYPE_LABELS: Labels<DocumentType> = {
  passport: t("Pasaport", "Passport"),
  photo: t("Biyometrik fotoğraf", "Biometric photo"),
  application_form: t("Başvuru formu", "Application form"),
  travel_insurance: t("Seyahat sağlık sigortası", "Travel insurance"),
  flight_booking: t("Uçuş rezervasyonu", "Flight booking"),
  accommodation: t("Konaklama belgesi", "Accommodation"),
  bank_statement: t("Banka dökümü", "Bank statement"),
  employment_letter: t("İşveren yazısı / SGK dökümü", "Employment letter"),
  payslip: t("Maaş bordrosu", "Payslip"),
  tax_certificate: t("Vergi levhası / faaliyet belgesi", "Tax certificate"),
  student_certificate: t("Öğrenci belgesi", "Student certificate"),
  civil_registry: t("Tam vukuatlı nüfus kayıt örneği", "Civil registry"),
  sponsor_documents: t("Sponsor dilekçesi ve belgeleri", "Sponsor documents"),
  invitation_letter: t("Davet mektubu", "Invitation letter"),
  transcript: t("Transkript", "Transcript"),
  diploma: t("Diploma / mezuniyet belgesi", "Diploma"),
  language_certificate: t("Dil yeterlilik belgesi", "Language certificate"),
  cv: t("Özgeçmiş (CV)", "CV"),
  motivation_letter: t("Niyet mektubu", "Statement of purpose"),
  reference_letter: t("Referans mektubu", "Reference letter"),
  portfolio: t("Portfolyo", "Portfolio"),
  offer_letter: t("Kabul mektubu", "Offer letter"),
  confirmation_letter: t(
    "Kabul onay belgesi (CAS / I-20 / CoE / LOA)",
    "Confirmation (CAS / I-20 / CoE / LOA)"
  ),
  financial_proof: t("Mali yeterlilik / bloke hesap", "Proof of funds"),
  medical: t("Sağlık raporu / TB testi", "Medical / TB test"),
  fee_receipt: t("Harç / ücret dekontu", "Fee receipt"),
  other: t("Diğer", "Other"),
}

export const DOCUMENT_TYPE_OPTIONS = toOptions(
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS
).map((item) => ({ ...item, color: "blue" as const }))

/* ------------------------------------------------------------ checklist */

export const CHECKLIST_STATUSES = [
  "missing",
  "requested",
  "received",
  "approved",
  "rejected",
  "not_applicable",
] as const
export type ChecklistStatus = (typeof CHECKLIST_STATUSES)[number]

/* ------------------------------------------------------------- payments */

export const PAYMENT_METHODS = ["cash", "transfer", "card"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_STATUSES = ["none", "on_track", "overdue", "paid"] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_STATUS_OPTIONS = toOptions(
  PAYMENT_STATUSES,
  {
    none: t("Plan yok", "No plan"),
    on_track: t("Zamanında", "On track"),
    overdue: t("Gecikmede", "Overdue"),
    paid: t("Ödendi", "Paid"),
  },
  { none: "gray", on_track: "blue", overdue: "red", paid: "green" }
)

/* --------------------------------------------------------- lost reasons */

export const LEAD_LOST_REASON_OPTIONS = [
  option("budget", t("Bütçe yetersiz", "Budget")),
  option("competitor", t("Başka danışmanlık", "Another agency")),
  option("postponed", t("Erteledi", "Postponed")),
  option("ineligible", t("Uygun değil", "Not eligible")),
  option("noResponse", t("Yanıt yok", "No response")),
  option("other", t("Diğer", "Other")),
]
