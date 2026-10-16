import { useTranslation } from "react-i18next"

import { type FieldInputProps } from "@/engine/field-types"
import { getCurrentLanguage } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"

import { MONTH_LABELS } from "../lib/constants"
import { toIntake, type IntakeValue } from "../lib/intake"
import { Picker } from "./shared"
import { YEARS } from "./intake"

// Inputs of ./intake, loaded on first render (lazyFieldInput).

export function IntakeInput(props: FieldInputProps<IntakeValue>) {
  const { t } = useTranslation("visaFields")
  const language = getCurrentLanguage()
  const current = toIntake(props.value) ?? (props.value as Partial<IntakeValue>)
  const update = (next: Partial<IntakeValue>) => {
    const value = { ...current, ...next }
    props.onChange(value.year || value.month ? (value as IntakeValue) : null)
  }
  const monthItems = MONTH_LABELS.map((label, index) => ({
    value: String(index + 1),
    label: resolveI18nText(label, language),
  }))
  const yearItems = YEARS.map((year) => ({
    value: String(year),
    label: String(year),
  }))

  return (
    <div
      className="flex gap-2"
      role="group"
      aria-labelledby={props.labelId}
      aria-label={props.labelId ? undefined : props.ariaLabel}
    >
      <Picker
        id={props.id}
        items={monthItems}
        value={current?.month ? String(current.month) : null}
        label={t("intake.month")}
        className="flex-1"
        invalid={props.invalid}
        disabled={props.disabled}
        describedBy={props.describedBy}
        onChange={(month) =>
          update({ month: month ? Number(month) : undefined })
        }
      />
      <Picker
        items={yearItems}
        value={current?.year ? String(current.year) : null}
        label={t("intake.year")}
        className="w-28"
        invalid={props.invalid}
        disabled={props.disabled}
        onChange={(year) => update({ year: year ? Number(year) : undefined })}
      />
    </div>
  )
}
