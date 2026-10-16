import type { CefrLevel } from "./constants"
import { latestEducation, normalizeGpa, type EducationEntry } from "./education"
import { intakeKey, toIntake, type IntakeValue } from "./intake"
import { meetsLanguageRequirement, type LanguageScore } from "./language"

/**
 * Eligibility of an applicant for a programme (B8.3). Findings are
 * warnings for the counsellor — they never block an application.
 */

export type EligibilityCode =
  | "LANGUAGE_MISSING"
  | "LANGUAGE_BELOW_MIN"
  | "LANGUAGE_EXPIRED"
  | "GPA_BELOW_MIN"
  | "DEADLINE_PASSED"
  | "INTAKE_NOT_OFFERED"

export interface EligibilityFinding {
  code: EligibilityCode
  params?: Record<string, string | number>
}

export interface ApplicantProfile {
  languageScores?: readonly LanguageScore[] | null
  educationHistory?: readonly EducationEntry[] | null
}

/** Programme values as stored on the `program` record. */
export interface ProgramRequirements {
  minIelts?: number | null
  minToefl?: number | null
  minPte?: number | null
  minDuolingo?: number | null
  minCefr?: CefrLevel | null
  minGpa?: number | null
  applicationDeadline?: string | null
  /** Month numbers as strings (multiselect). */
  intakeMonths?: readonly string[] | null
}

export function checkEligibility(
  applicant: ApplicantProfile,
  program: ProgramRequirements,
  { today, intake }: { today: string; intake?: IntakeValue | null }
): EligibilityFinding[] {
  const findings: EligibilityFinding[] = []

  const language = meetsLanguageRequirement(
    applicant.languageScores ?? [],
    program,
    today
  )
  if (language.status === "missing") findings.push({ code: "LANGUAGE_MISSING" })
  if (language.status === "expired") {
    findings.push({
      code: "LANGUAGE_EXPIRED",
      params: { date: language.score.testDate ?? "" },
    })
  }
  if (language.status === "below") {
    findings.push({
      code: "LANGUAGE_BELOW_MIN",
      params: {
        required: language.required,
        actual:
          `${language.score.exam} ${language.score.overall ?? language.score.level ?? ""}`.trim(),
      },
    })
  }

  if (typeof program.minGpa === "number") {
    const latest = latestEducation(applicant.educationHistory ?? [])
    const gpa = latest ? normalizeGpa(latest) : null
    if (gpa !== null && gpa < program.minGpa) {
      findings.push({
        code: "GPA_BELOW_MIN",
        params: { required: program.minGpa, actual: gpa },
      })
    }
  }

  if (program.applicationDeadline && program.applicationDeadline < today) {
    findings.push({
      code: "DEADLINE_PASSED",
      params: { date: program.applicationDeadline },
    })
  }

  const target = toIntake(intake)
  if (
    target &&
    program.intakeMonths?.length &&
    !program.intakeMonths.includes(String(target.month))
  ) {
    findings.push({
      code: "INTAKE_NOT_OFFERED",
      params: { intake: intakeKey(target) },
    })
  }
  return findings
}
