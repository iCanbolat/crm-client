import { GraduationCapIcon } from "lucide-react"
import { z } from "zod"

import {
  EmptyValue,
  type FieldTypeDefinition,
  lazyFieldInput,
} from "@/engine/field-types"
import { getCountryName } from "@/lib/countries"
import i18n, { getCurrentLanguage } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"

import { STUDY_LEVEL_LABELS, STUDY_LEVELS } from "../lib/constants"
import { latestEducation, type EducationEntry } from "../lib/education"

const educationMessage = {
  error: () => i18n.t("visaFields:validation.education"),
}

const entrySchema = z
  .object({
    level: z.enum(STUDY_LEVELS, educationMessage),
    institution: z.string().trim().min(1, educationMessage).max(160),
    country: z.string().nullish(),
    field: z.string().max(120).nullish(),
    gpa: z.number().min(0).nullish(),
    gpaScale: z.union([z.literal(4), z.literal(5), z.literal(100)]).nullish(),
    graduationYear: z.number().int().min(1950).max(2040).nullish(),
  })
  .refine(
    (entry) =>
      typeof entry.gpa !== "number" ||
      (entry.gpaScale !== null &&
        entry.gpaScale !== undefined &&
        entry.gpa <= entry.gpaScale),
    educationMessage
  )

export function toEducationHistory(value: unknown): EducationEntry[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const parsed = entrySchema.safeParse(item)
    return parsed.success ? [parsed.data as EducationEntry] : []
  })
}

function formatEntry(entry: EducationEntry, language: "tr" | "en") {
  const level = resolveI18nText(STUDY_LEVEL_LABELS[entry.level], language)
  const year = entry.graduationYear ? ` (${entry.graduationYear})` : ""
  return `${level} — ${entry.institution}${year}`
}

function EducationHistoryCell({ value }: { value: unknown }) {
  const latest = latestEducation(toEducationHistory(value))
  if (!latest) return <EmptyValue />
  const language = getCurrentLanguage()
  return (
    <span>
      {formatEntry(latest, language)}
      {latest.country ? ` · ${getCountryName(latest.country, language)}` : ""}
    </span>
  )
}

export const educationHistoryFieldType: FieldTypeDefinition<EducationEntry[]> =
  {
    type: "educationHistory",
    icon: GraduationCapIcon,
    toZod: () =>
      z.array(entrySchema).min(1) as unknown as z.ZodType<EducationEntry[]>,
    isEmpty: (value) => toEducationHistory(value).length === 0,
    toComparable: (value) =>
      latestEducation(toEducationHistory(value))?.graduationYear ?? null,
    format: (value, { language }) =>
      value.map((entry) => formatEntry(entry, language)).join("; "),
    filterOperators: ["isEmpty", "isNotEmpty"],
    sortable: true,
    creatable: false,
    Cell: EducationHistoryCell,
    Input: lazyFieldInput(() =>
      import("./inputs").then((module) => module.EducationHistoryInput)
    ),
  }
