import { CEFR_LEVELS, t, type CefrLevel } from "./constants"

/**
 * Language exams (B8.2): score ranges, steps, validity and an approximate
 * CEFR equivalence. Equivalences are indicative (published concordance
 * tables), good enough for eligibility warnings — never for decisions.
 */

export const LANGUAGE_EXAMS = [
  "IELTS",
  "TOEFL",
  "PTE",
  "DUOLINGO",
  "YDS",
  "TESTDAF",
  "GOETHE",
  "DELF",
] as const
export type LanguageExam = (typeof LANGUAGE_EXAMS)[number]

interface Range {
  min: number
  max: number
  step: number
}

export interface ExamDef {
  label: ReturnType<typeof t>
  /** `score`: numeric overall (+ optional sub-scores); `level`: CEFR level. */
  kind: "score" | "level"
  overall?: Range
  sub?: Range
  /** Months a result is accepted for; `null` = no expiry. */
  validityMonths: number | null
  /** Lower bounds of A2…C2 on the overall score (score exams). */
  cefrBands?: [number, number, number, number, number]
}

export const EXAMS: Record<LanguageExam, ExamDef> = {
  IELTS: {
    label: t("IELTS Academic", "IELTS Academic"),
    kind: "score",
    overall: { min: 0, max: 9, step: 0.5 },
    sub: { min: 0, max: 9, step: 0.5 },
    validityMonths: 24,
    cefrBands: [3, 4, 5.5, 7, 8.5],
  },
  TOEFL: {
    label: t("TOEFL iBT", "TOEFL iBT"),
    kind: "score",
    overall: { min: 0, max: 120, step: 1 },
    sub: { min: 0, max: 30, step: 1 },
    validityMonths: 24,
    cefrBands: [20, 42, 72, 95, 114],
  },
  PTE: {
    label: t("PTE Academic", "PTE Academic"),
    kind: "score",
    overall: { min: 10, max: 90, step: 1 },
    sub: { min: 10, max: 90, step: 1 },
    validityMonths: 24,
    cefrBands: [30, 43, 59, 76, 85],
  },
  DUOLINGO: {
    label: t("Duolingo English Test", "Duolingo English Test"),
    kind: "score",
    overall: { min: 10, max: 160, step: 5 },
    validityMonths: 24,
    cefrBands: [30, 60, 100, 130, 155],
  },
  YDS: {
    label: t("YDS / YÖKDİL", "YDS / YÖKDİL"),
    kind: "score",
    overall: { min: 0, max: 100, step: 0.25 },
    validityMonths: 60,
    cefrBands: [30, 50, 60, 80, 90],
  },
  TESTDAF: {
    label: t("TestDaF (TDN)", "TestDaF (TDN)"),
    kind: "score",
    overall: { min: 3, max: 5, step: 1 },
    sub: { min: 3, max: 5, step: 1 },
    validityMonths: null,
    cefrBands: [0, 0, 3, 4, 6],
  },
  GOETHE: {
    label: t("Goethe-Zertifikat", "Goethe-Zertifikat"),
    kind: "level",
    validityMonths: null,
  },
  DELF: {
    label: t("DELF / DALF", "DELF / DALF"),
    kind: "level",
    validityMonths: null,
  },
}

export interface LanguageScore {
  exam: LanguageExam
  overall?: number | null
  listening?: number | null
  reading?: number | null
  writing?: number | null
  speaking?: number | null
  level?: CefrLevel | null
  /** `yyyy-MM-dd` */
  testDate?: string | null
}

export const SUB_SCORES = [
  "listening",
  "reading",
  "writing",
  "speaking",
] as const

export type ScoreIssue =
  | { code: "unknownExam" }
  | { code: "overallRequired" }
  | { code: "levelRequired" }
  | { code: "outOfRange"; key: string; min: number; max: number }
  | { code: "step"; key: string; step: number }

function checkValue(
  key: string,
  value: number | null | undefined,
  range: Range
): ScoreIssue | null {
  if (value === null || value === undefined) return null
  if (value < range.min || value > range.max) {
    return { code: "outOfRange", key, min: range.min, max: range.max }
  }
  const steps = (value - range.min) / range.step
  if (Math.abs(steps - Math.round(steps)) > 1e-9) {
    return { code: "step", key, step: range.step }
  }
  return null
}

/** First problem of a score row, `null` when valid. */
export function validateScore(score: LanguageScore): ScoreIssue | null {
  const exam = EXAMS[score.exam]
  if (!exam) return { code: "unknownExam" }
  if (exam.kind === "level") {
    return score.level ? null : { code: "levelRequired" }
  }
  if (score.overall === null || score.overall === undefined) {
    return { code: "overallRequired" }
  }
  const overall = checkValue("overall", score.overall, exam.overall!)
  if (overall) return overall
  if (!exam.sub) return null
  for (const key of SUB_SCORES) {
    const issue = checkValue(key, score[key], exam.sub)
    if (issue) return issue
  }
  return null
}

const cefrIndex = (level: CefrLevel) => CEFR_LEVELS.indexOf(level)

/** Approximate CEFR level of a result; `null` below A2 or unknown. */
export function toCefr(score: LanguageScore): CefrLevel | null {
  const exam = EXAMS[score.exam]
  if (!exam) return null
  if (exam.kind === "level") return score.level ?? null
  if (typeof score.overall !== "number") return null
  const bands = exam.cefrBands!
  let level: CefrLevel | null = score.overall >= bands[0] ? "A2" : null
  const upper: CefrLevel[] = ["B1", "B2", "C1", "C2"]
  upper.forEach((item, index) => {
    if (score.overall! >= bands[index + 1]!) level = item
  })
  return level
}

export function compareCefr(a: CefrLevel, b: CefrLevel) {
  return cefrIndex(a) - cefrIndex(b)
}

/** Expired results are no longer accepted (IELTS/TOEFL/PTE: 2 years). */
export function isScoreExpired(score: LanguageScore, today: string) {
  const months = EXAMS[score.exam]?.validityMonths
  if (!months || !score.testDate) return false
  const expiry = new Date(`${score.testDate}T00:00:00Z`)
  expiry.setUTCMonth(expiry.getUTCMonth() + months)
  return expiry.toISOString().slice(0, 10) < today
}

/** Best result by CEFR (then most recent): shown on cards and lists. */
export function bestScore(scores: readonly LanguageScore[]) {
  let best: { score: LanguageScore; cefr: CefrLevel | null } | null = null
  for (const score of scores) {
    const cefr = toCefr(score)
    if (
      !best ||
      (cefr && (!best.cefr || compareCefr(cefr, best.cefr) > 0)) ||
      (cefr === best.cefr &&
        (score.testDate ?? "") > (best.score.testDate ?? ""))
    ) {
      best = { score, cefr }
    }
  }
  return best
}

export interface LanguageRequirement {
  minIelts?: number | null
  minToefl?: number | null
  minPte?: number | null
  minDuolingo?: number | null
  minCefr?: CefrLevel | null
}

export type RequirementResult =
  | { status: "none" }
  | { status: "met"; score: LanguageScore }
  | { status: "missing" }
  | { status: "expired"; score: LanguageScore }
  | { status: "below"; score: LanguageScore; required: string }

const DIRECT_MINIMUMS: [LanguageExam, keyof LanguageRequirement][] = [
  ["IELTS", "minIelts"],
  ["TOEFL", "minToefl"],
  ["PTE", "minPte"],
  ["DUOLINGO", "minDuolingo"],
]

function meets(score: LanguageScore, requirement: LanguageRequirement) {
  for (const [exam, key] of DIRECT_MINIMUMS) {
    const min = requirement[key]
    if (score.exam === exam && typeof min === "number") {
      return typeof score.overall === "number" && score.overall >= min
    }
  }
  const cefr = toCefr(score)
  return Boolean(
    requirement.minCefr && cefr && compareCefr(cefr, requirement.minCefr) >= 0
  )
}

function describeRequirement(requirement: LanguageRequirement) {
  const parts: string[] = []
  for (const [exam, key] of DIRECT_MINIMUMS) {
    const min = requirement[key]
    if (typeof min === "number") parts.push(`${exam} ${min}`)
  }
  if (requirement.minCefr) parts.push(`CEFR ${requirement.minCefr}`)
  return parts.join(" / ")
}

/**
 * Does any result satisfy the programme's language requirement? A direct
 * minimum of the same exam wins over the CEFR fallback.
 */
export function meetsLanguageRequirement(
  scores: readonly LanguageScore[],
  requirement: LanguageRequirement,
  today: string
): RequirementResult {
  const hasRequirement =
    DIRECT_MINIMUMS.some(([, key]) => typeof requirement[key] === "number") ||
    Boolean(requirement.minCefr)
  if (!hasRequirement) return { status: "none" }
  if (scores.length === 0) return { status: "missing" }

  const valid = scores.filter((score) => !isScoreExpired(score, today))
  const met = valid.find((score) => meets(score, requirement))
  if (met) return { status: "met", score: met }
  const expired = scores.find(
    (score) => isScoreExpired(score, today) && meets(score, requirement)
  )
  if (expired) return { status: "expired", score: expired }
  const best = bestScore(valid.length ? valid : scores)!.score
  return {
    status: "below",
    score: best,
    required: describeRequirement(requirement),
  }
}

/** "IELTS 6.5" · "Goethe B2" */
export function formatScore(score: LanguageScore) {
  const exam = EXAMS[score.exam]
  if (!exam) return score.exam
  const name = score.exam === "DUOLINGO" ? "Duolingo" : score.exam
  if (exam.kind === "level") return `${name} ${score.level ?? ""}`.trim()
  return `${name} ${score.overall ?? ""}`.trim()
}
