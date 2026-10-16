import type { AnyFieldTypeDefinition } from "@/engine/field-types"

import { educationHistoryFieldType } from "./education-history"
import { intakeFieldType } from "./intake"
import { languageScoreFieldType } from "./language-score"
import { passportFieldType } from "./passport"

export const visaEducationFieldTypes: AnyFieldTypeDefinition[] = [
  passportFieldType,
  languageScoreFieldType,
  educationHistoryFieldType,
  intakeFieldType,
]

export { toEducationHistory } from "./education-history"
export { toLanguageScores } from "./language-score"
export { PassportValidityBadge, toPassport } from "./passport"
