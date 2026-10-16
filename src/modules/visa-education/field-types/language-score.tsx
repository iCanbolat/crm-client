import { LanguagesIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import {
  EmptyValue,
  type FieldTypeDefinition,
  lazyFieldInput,
} from "@/engine/field-types"
import i18n from "@/lib/i18n"

import { CEFR_LEVELS } from "../lib/constants"
import {
  bestScore,
  formatScore,
  isScoreExpired,
  LANGUAGE_EXAMS,
  toCefr,
  validateScore,
  type LanguageScore,
} from "../lib/language"
import { DATE_PATTERN } from "./shared"

const score = z.number().nullish()

const rowSchema = z
  .object({
    exam: z.enum(LANGUAGE_EXAMS),
    overall: score,
    listening: score,
    reading: score,
    writing: score,
    speaking: score,
    level: z.enum(CEFR_LEVELS).nullish(),
    testDate: z.string().regex(DATE_PATTERN).nullish(),
  })
  .superRefine((row, ctx) => {
    const issue = validateScore(row)
    if (!issue) return
    const exam = row.exam
    const message =
      issue.code === "levelRequired"
        ? i18n.t("visaFields:validation.levelRequired", { exam })
        : issue.code === "outOfRange"
          ? i18n.t("visaFields:validation.scoreRange", {
              exam,
              min: issue.min,
              max: issue.max,
            })
          : issue.code === "step"
            ? i18n.t("visaFields:validation.scoreStep", {
                exam,
                step: issue.step,
              })
            : i18n.t("visaFields:validation.scoreRequired", { exam })
    ctx.addIssue({ code: "custom", message })
  })

const scoresSchema = z.array(rowSchema).min(1)

export function toLanguageScores(value: unknown): LanguageScore[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const parsed = rowSchema.safeParse(item)
    return parsed.success ? [parsed.data as LanguageScore] : []
  })
}

const today = () => new Date().toISOString().slice(0, 10)

function LanguageScoreCell({ value }: { value: unknown }) {
  const { t } = useTranslation("visaFields")
  const scores = toLanguageScores(value)
  const best = bestScore(scores)
  if (!best) return <EmptyValue />
  const expired = isScoreExpired(best.score, today())
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="tabular-nums">{formatScore(best.score)}</span>
      {best.cefr && <Badge variant="secondary">{best.cefr}</Badge>}
      {expired && <Badge variant="outline">{t("language.expired")}</Badge>}
      {scores.length > 1 && (
        <span className="text-xs text-muted-foreground">
          {t("language.more", { count: scores.length - 1 })}
        </span>
      )}
    </span>
  )
}

export const languageScoreFieldType: FieldTypeDefinition<LanguageScore[]> = {
  type: "languageScore",
  icon: LanguagesIcon,
  toZod: () => scoresSchema as unknown as z.ZodType<LanguageScore[]>,
  isEmpty: (value) => toLanguageScores(value).length === 0,
  // Highest CEFR level (0 = A1 … 5 = C2) for sorting.
  toComparable: (value) => {
    const cefr = bestScore(toLanguageScores(value))?.cefr
    return cefr ? CEFR_LEVELS.indexOf(cefr) : null
  },
  format: (value) =>
    value
      .map((row) => {
        const cefr = toCefr(row)
        return cefr ? `${formatScore(row)} (${cefr})` : formatScore(row)
      })
      .join(", "),
  filterOperators: ["isEmpty", "isNotEmpty"],
  sortable: true,
  creatable: false,
  Cell: LanguageScoreCell,
  Input: lazyFieldInput(() =>
    import("./inputs").then((module) => module.LanguageScoreInput)
  ),
}
