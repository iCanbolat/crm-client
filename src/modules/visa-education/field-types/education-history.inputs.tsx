import { PlusIcon, Trash2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { type FieldInputProps } from "@/engine/field-types"
import { getCurrentLanguage } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"

import {
  STUDY_LEVEL_LABELS,
  STUDY_LEVELS,
  type StudyLevel,
} from "../lib/constants"
import { GPA_SCALES, type EducationEntry } from "../lib/education"
import { parseNumber, Picker } from "./shared"

// Inputs of ./education-history, loaded on first render (lazyFieldInput).

export function EducationHistoryInput(
  props: FieldInputProps<EducationEntry[]>
) {
  const { t } = useTranslation("visaFields")
  const language = getCurrentLanguage()
  const rows = Array.isArray(props.value) ? props.value : []
  const update = (next: EducationEntry[]) =>
    props.onChange(next.length ? next : null)
  const setRow = (index: number, patch: Partial<EducationEntry>) =>
    update(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  const levelItems = STUDY_LEVELS.map((level) => ({
    value: level,
    label: resolveI18nText(STUDY_LEVEL_LABELS[level], language),
  }))
  const scaleItems = GPA_SCALES.map((scale) => ({
    value: String(scale),
    label: t("education.scaleValue", { value: scale }),
  }))
  const invalid = props.invalid ? true : undefined

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
      {rows.map((row, index) => (
        <div
          key={index}
          className="grid gap-2 rounded-md border p-2 sm:grid-cols-2"
          data-testid="education-row"
        >
          <Picker
            items={levelItems}
            value={row.level ?? null}
            label={t("education.level")}
            invalid={props.invalid}
            disabled={props.disabled}
            onChange={(level) => setRow(index, { level: level as StudyLevel })}
          />
          <Input
            aria-label={t("education.institution")}
            placeholder={t("education.institution")}
            aria-invalid={invalid}
            disabled={props.disabled}
            onBlur={props.onBlur}
            value={row.institution ?? ""}
            onChange={(event) =>
              setRow(index, { institution: event.target.value })
            }
          />
          <Input
            aria-label={t("education.field")}
            placeholder={t("education.field")}
            disabled={props.disabled}
            value={row.field ?? ""}
            onChange={(event) =>
              setRow(index, { field: event.target.value || null })
            }
          />
          <Input
            type="number"
            inputMode="numeric"
            aria-label={t("education.graduationYear")}
            placeholder={t("education.graduationYear")}
            disabled={props.disabled}
            value={row.graduationYear ?? ""}
            onChange={(event) =>
              setRow(index, {
                graduationYear: parseNumber(event.target.value),
              })
            }
          />
          <div className="flex items-center gap-2 sm:col-span-2">
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              className="w-28"
              aria-label={t("education.gpa")}
              placeholder={t("education.gpa")}
              aria-invalid={invalid}
              disabled={props.disabled}
              value={row.gpa ?? ""}
              onChange={(event) =>
                setRow(index, { gpa: parseNumber(event.target.value) })
              }
            />
            <Picker
              items={scaleItems}
              value={row.gpaScale ? String(row.gpaScale) : null}
              label={t("education.gpaScale")}
              className="w-32"
              disabled={props.disabled}
              onChange={(scale) =>
                setRow(index, {
                  gpaScale: scale
                    ? (Number(scale) as EducationEntry["gpaScale"])
                    : null,
                })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="ms-auto"
              aria-label={t("removeRow")}
              disabled={props.disabled}
              onClick={() => update(rows.filter((_, i) => i !== index))}
            >
              <Trash2Icon aria-hidden />
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={props.disabled}
        autoFocus={props.autoFocus && rows.length === 0}
        onClick={() =>
          update([...rows, { level: "bachelor", institution: "", gpaScale: 4 }])
        }
      >
        <PlusIcon aria-hidden />
        {t("education.add")}
      </Button>
    </div>
  )
}
