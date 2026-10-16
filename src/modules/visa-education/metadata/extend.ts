import type { Condition } from "@/engine/logic"
import type { FieldDef } from "@/engine/metadata"
import type { ObjectExtension } from "@/engine/modules"
import { getCountryName } from "@/lib/countries"

import {
  DESTINATION_COUNTRIES,
  FIELD_OF_STUDY_OPTIONS,
  option,
  PERSON_ROLE_OPTIONS,
  SERVICE_TYPE_OPTIONS,
  STUDY_LEVEL_OPTIONS,
  t,
  VISA_CATEGORY_OPTIONS,
} from "../lib/constants"
import { relation } from "./shared"

/** Destination picklist (multiselect needs fixed options, not `country`). */
export const DESTINATION_OPTIONS = DESTINATION_COUNTRIES.map((code) =>
  option(code, t(getCountryName(code, "tr"), getCountryName(code, "en")))
)

const serviceIn = (...values: string[]): Condition[] => [
  { field: "serviceType", op: "in", value: values },
]

/**
 * Applicant profile: the same keys on leads and contacts, so the
 * conversion copies them over (B8.4).
 */
export function profileFields(): FieldDef[] {
  return [
    {
      key: "dateOfBirth",
      label: t("Doğum tarihi", "Date of birth"),
      type: "date",
      sensitivity: "personal",
    },
    { key: "nationality", label: t("Uyruk", "Nationality"), type: "country" },
    {
      key: "passport",
      label: t("Pasaport", "Passport"),
      type: "passport",
      sensitivity: "personal",
    },
    {
      key: "languageScores",
      label: t("Dil sınavları", "Language tests"),
      type: "languageScore",
    },
    {
      key: "educationHistory",
      label: t("Eğitim geçmişi", "Education history"),
      type: "educationHistory",
    },
  ]
}

export const PROFILE_FIELD_KEYS = [
  "dateOfBirth",
  "nationality",
  "passport",
  "languageScores",
  "educationHistory",
]

/** Consultancy enquiry on top of the core lead (B8.4). */
export const leadExtension: ObjectExtension = {
  fields: [
    {
      key: "serviceType",
      label: t("Hizmet", "Service"),
      type: "select",
      options: SERVICE_TYPE_OPTIONS,
    },
    {
      key: "targetCountries",
      label: t("Hedef ülkeler", "Target countries"),
      type: "multiselect",
      options: DESTINATION_OPTIONS,
    },
    {
      key: "studyLevel",
      label: t("Eğitim seviyesi", "Study level"),
      type: "select",
      options: STUDY_LEVEL_OPTIONS,
      visibleWhen: serviceIn("education", "both"),
    },
    {
      key: "fieldOfStudy",
      label: t("İlgilenilen alan", "Field of study"),
      type: "select",
      options: FIELD_OF_STUDY_OPTIONS,
      visibleWhen: serviceIn("education", "both"),
    },
    {
      key: "desiredIntake",
      label: t("Hedef dönem", "Desired intake"),
      type: "intake",
      visibleWhen: serviceIn("education", "both"),
    },
    {
      key: "budgetPerYear",
      label: t("Yıllık bütçe", "Budget per year"),
      type: "currency",
      validation: { min: 0 },
    },
    {
      key: "visaCategory",
      label: t("Vize türü", "Visa category"),
      type: "select",
      options: VISA_CATEGORY_OPTIONS,
      visibleWhen: serviceIn("visa", "both"),
    },
    {
      key: "plannedTravelDate",
      label: t("Planlanan seyahat", "Planned travel"),
      type: "date",
    },
    ...profileFields(),
  ],
  sections: [
    {
      key: "enquiry",
      label: t("Danışmanlık talebi", "Enquiry"),
      fields: [
        "serviceType",
        "targetCountries",
        "studyLevel",
        "fieldOfStudy",
        "desiredIntake",
        "budgetPerYear",
        "visaCategory",
        "plannedTravelDate",
      ],
    },
    {
      key: "applicantProfile",
      label: t("Başvuran profili", "Applicant profile"),
      fields: PROFILE_FIELD_KEYS,
    },
  ],
  columns: ["serviceType", "targetCountries"],
  related: [
    { objectKey: "enrollment", field: "leadId" },
    { objectKey: "visaApplication", field: "leadId" },
  ],
}

/** Applicants and their parents / sponsors are contacts (B8.4). */
export const contactExtension: ObjectExtension = {
  fields: [
    {
      key: "personRoles",
      label: t("Rol", "Role"),
      type: "multiselect",
      options: PERSON_ROLE_OPTIONS,
    },
    ...profileFields(),
    {
      key: "sponsorId",
      label: t("Veli / sponsor", "Parent / sponsor"),
      type: "relation",
      relation: relation("contact"),
    },
  ],
  sections: [
    {
      key: "applicantProfile",
      label: t("Başvuran profili", "Applicant profile"),
      fields: ["personRoles", ...PROFILE_FIELD_KEYS, "sponsorId"],
    },
  ],
  columns: ["personRoles", "nationality"],
  related: [
    { objectKey: "enrollment", field: "applicantId" },
    { objectKey: "visaApplication", field: "applicantId" },
    { objectKey: "appointment", field: "applicantId" },
  ],
}
