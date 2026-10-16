import {
  BookUserIcon,
  GraduationCapIcon,
  LanguagesIcon,
  PlaneIcon,
  SchoolIcon,
} from "lucide-react"

import type { FormBlockDef } from "@/engine/forms"

import {
  FIELD_OF_STUDY_OPTIONS,
  STUDY_LEVEL_OPTIONS,
  t,
  VISA_CATEGORY_OPTIONS,
} from "./lib/constants"
import { DESTINATION_OPTIONS } from "./metadata/extend"

/**
 * Form builder blocks of the visa & education module (B8.4). Keys and
 * types match the lead extension, so every field maps automatically.
 */
export const visaEducationFormBlocks: FormBlockDef[] = [
  {
    id: "visa.targetStudy",
    label: t("Hedef ülke & program", "Destination & programme"),
    description: t(
      "Ülkeler, seviye, alan, dönem ve bütçe",
      "Countries, level, field, intake and budget"
    ),
    icon: SchoolIcon,
    fields: [
      {
        key: "targetCountries",
        type: "checkboxes",
        label: t(
          "Hangi ülkelerde okumak istiyorsunuz?",
          "Where would you like to study?"
        ),
        required: true,
        options: DESTINATION_OPTIONS,
        mapTo: "targetCountries",
      },
      {
        key: "studyLevel",
        type: "select",
        label: t("Eğitim seviyesi", "Study level"),
        required: true,
        options: STUDY_LEVEL_OPTIONS,
        width: "half",
        mapTo: "studyLevel",
      },
      {
        key: "fieldOfStudy",
        type: "select",
        label: t("İlgilendiğiniz alan", "Field of study"),
        options: FIELD_OF_STUDY_OPTIONS,
        width: "half",
        mapTo: "fieldOfStudy",
      },
      {
        key: "desiredIntake",
        type: "intake",
        label: t(
          "Ne zaman başlamak istiyorsunuz?",
          "When would you like to start?"
        ),
        width: "half",
        mapTo: "desiredIntake",
      },
      {
        key: "budgetPerYear",
        type: "currency",
        label: t("Yıllık bütçe", "Budget per year"),
        validation: { min: 0 },
        width: "half",
        mapTo: "budgetPerYear",
      },
    ],
  },
  {
    id: "visa.education",
    label: t("Eğitim geçmişi", "Education history"),
    description: t(
      "Mezun olunan okullar ve not ortalaması",
      "Schools attended and grades"
    ),
    icon: GraduationCapIcon,
    fields: [
      {
        key: "educationHistory",
        type: "educationHistory",
        label: t("Eğitim geçmişi", "Education history"),
        mapTo: "educationHistory",
      },
    ],
  },
  {
    id: "visa.language",
    label: t("Dil skoru", "Language score"),
    description: t(
      "IELTS, TOEFL, PTE, Duolingo, Goethe…",
      "IELTS, TOEFL, PTE, Duolingo, Goethe…"
    ),
    icon: LanguagesIcon,
    fields: [
      {
        key: "languageScores",
        type: "languageScore",
        label: t("Dil sınavı sonuçlarınız", "Your language test results"),
        helpText: t(
          "Henüz sınava girmediyseniz boş bırakabilirsiniz.",
          "Leave empty if you have not taken a test yet."
        ),
        mapTo: "languageScores",
      },
    ],
  },
  {
    id: "visa.passport",
    label: t("Pasaport bilgisi", "Passport details"),
    description: t(
      "Pasaport, uyruk ve doğum tarihi",
      "Passport, nationality and date of birth"
    ),
    icon: BookUserIcon,
    fields: [
      {
        key: "passport",
        type: "passport",
        label: t("Pasaport", "Passport"),
        mapTo: "passport",
      },
      {
        key: "nationality",
        type: "country",
        label: t("Uyruk", "Nationality"),
        width: "half",
        mapTo: "nationality",
      },
      {
        key: "dateOfBirth",
        type: "date",
        label: t("Doğum tarihi", "Date of birth"),
        width: "half",
        mapTo: "dateOfBirth",
      },
    ],
  },
  {
    id: "visa.visaRequest",
    label: t("Vize talebi", "Visa request"),
    description: t(
      "Vize türü, gidilecek ülke ve seyahat tarihi",
      "Visa category, destination and travel date"
    ),
    icon: PlaneIcon,
    fields: [
      {
        key: "visaCategory",
        type: "select",
        label: t("Vize türü", "Visa category"),
        required: true,
        options: VISA_CATEGORY_OPTIONS,
        mapTo: "visaCategory",
      },
      {
        key: "targetCountries",
        type: "checkboxes",
        label: t("Gidilecek ülke", "Destination"),
        required: true,
        options: DESTINATION_OPTIONS,
        mapTo: "targetCountries",
      },
      {
        key: "plannedTravelDate",
        type: "date",
        label: t("Planlanan seyahat tarihi", "Planned travel date"),
        mapTo: "plannedTravelDate",
      },
    ],
  },
]
