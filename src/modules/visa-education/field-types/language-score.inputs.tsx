import { PlusIcon, Trash2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { type FieldInputProps } from "@/engine/field-types"
import { getCurrentLanguage } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"

import { CEFR_LEVELS } from "../lib/constants"
import {
  EXAMS,
  LANGUAGE_EXAMS,
  SUB_SCORES,
  type LanguageScore,
} from "../lib/language"
import { parseNumber, Picker } from "./shared"

// Inputs of ./language-score, loaded on first render (lazyFieldInput).

export function LanguageScoreInput(props: FieldInputProps<LanguageScore[]>) {
  const { t } = useTranslation("visaFields")
  const language = getCurrentLanguage()
  const rows = Array.isArray(props.value) ? props.value : []
  const update = (next: LanguageScore[]) =>
    props.onChange(next.length ? next : null)
  const setRow = (index: number, patch: Partial<LanguageScore>) =>
    update(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  const examItems = LANGUAGE_EXAMS.map((exam) => ({
    value: exam,
    label: resolveI18nText(EXAMS[exam].label, language),
  }))
  const levelItems = CEFR_LEVELS.map((level) => ({
    value: level,
    label: level,
  }))

  return (
    <div
      id={props.id}
      tabIndex={-1}
      className="flex flex-col gap-3 outline-none"
      role="group"
      aria-labelledby={props.labelId}
      aria-label={props.labelId ? undefined : props.ariaLabel}
      aria-describedby={props.describedBy}
    >
      {rows.map((row, index) => {
        const exam = EXAMS[row.exam]
        const range = exam?.overall
        return (
          <div
            key={index}
            className="flex flex-col gap-2 rounded-md border p-2"
            data-testid="language-score-row"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Picker
                items={examItems}
                value={row.exam}
                label={t("language.exam")}
                className="w-48"
                invalid={props.invalid}
                disabled={props.disabled}
                onChange={(next) =>
                  next &&
                  setRow(index, {
                    exam: next as LanguageScore["exam"],
                    overall: null,
                    level: null,
                  })
                }
              />
              {exam?.kind === "level" ? (
                <Picker
                  items={levelItems}
                  value={row.level ?? null}
                  label={t("language.level")}
                  className="w-24"
                  invalid={props.invalid}
                  disabled={props.disabled}
                  onChange={(level) =>
                    setRow(index, { level: level as LanguageScore["level"] })
                  }
                />
              ) : (
                <Input
                  type="number"
                  inputMode="decimal"
                  className="w-24"
                  min={range?.min}
                  max={range?.max}
                  step={range?.step}
                  aria-label={t("language.overall")}
                  aria-invalid={props.invalid ? true : undefined}
                  disabled={props.disabled}
                  onBlur={props.onBlur}
                  value={row.overall ?? ""}
                  onChange={(event) =>
                    setRow(index, { overall: parseNumber(event.target.value) })
                  }
                />
              )}
              <Input
                type="date"
                className="w-40"
                aria-label={t("language.testDate")}
                disabled={props.disabled}
                value={row.testDate ?? ""}
                onChange={(event) =>
                  setRow(index, { testDate: event.target.value || null })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("removeRow")}
                disabled={props.disabled}
                onClick={() => update(rows.filter((_, i) => i !== index))}
              >
                <Trash2Icon aria-hidden />
              </Button>
            </div>
            {exam?.sub && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SUB_SCORES.map((key) => (
                  <Input
                    key={key}
                    type="number"
                    inputMode="decimal"
                    min={exam.sub!.min}
                    max={exam.sub!.max}
                    step={exam.sub!.step}
                    aria-label={t(`language.${key}`)}
                    placeholder={t(`language.${key}`)}
                    disabled={props.disabled}
                    value={row[key] ?? ""}
                    onChange={(event) =>
                      setRow(index, { [key]: parseNumber(event.target.value) })
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={props.disabled}
        autoFocus={props.autoFocus && rows.length === 0}
        onClick={() => update([...rows, { exam: "IELTS", overall: null }])}
      >
        <PlusIcon aria-hidden />
        {t("language.add")}
      </Button>
    </div>
  )
}
