import type { StudyLevel } from "./constants"

/** One completed (or ongoing) degree of an applicant (B8.2). */
export interface EducationEntry {
  level: StudyLevel
  institution: string
  country?: string | null
  field?: string | null
  gpa?: number | null
  gpaScale?: 4 | 5 | 100 | null
  graduationYear?: number | null
}

export const GPA_SCALES = [4, 5, 100] as const

/** GPA on the 4-point scale programmes publish their minimum on. */
export function normalizeGpa(entry: EducationEntry): number | null {
  if (typeof entry.gpa !== "number" || !entry.gpaScale) return null
  return Math.round((entry.gpa / entry.gpaScale) * 4 * 100) / 100
}

/** Most recent entry (by graduation year, ongoing last-listed wins ties). */
export function latestEducation(entries: readonly EducationEntry[]) {
  let latest: EducationEntry | null = null
  for (const entry of entries) {
    if (
      !latest ||
      (entry.graduationYear ?? Infinity) >= (latest.graduationYear ?? Infinity)
    ) {
      latest = entry
    }
  }
  return latest
}
