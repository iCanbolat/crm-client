import { CalendarRangeIcon } from "lucide-react"
import { z } from "zod"

import {
  EmptyValue,
  type FieldTypeDefinition,
  lazyFieldInput,
} from "@/engine/field-types"
import i18n, { getCurrentLanguage } from "@/lib/i18n"

import {
  formatIntake,
  intakeKey,
  toIntake,
  type IntakeValue,
} from "../lib/intake"

const intakeMessage = { error: () => i18n.t("visaFields:validation.intake") }

const intakeSchema = z.object({
  year: z.number().int().min(2020, intakeMessage).max(2040, intakeMessage),
  month: z.number().int().min(1, intakeMessage).max(12, intakeMessage),
})

export const YEARS = Array.from({ length: 8 }, (_, index) => 2025 + index)

export const intakeFieldType: FieldTypeDefinition<IntakeValue> = {
  type: "intake",
  icon: CalendarRangeIcon,
  toZod: () => intakeSchema,
  isEmpty: (value) => toIntake(value) === null,
  toComparable: (value) => {
    const intake = toIntake(value)
    return intake ? intakeKey(intake) : null
  },
  format: (value, { language }) => formatIntake(value, language),
  filterOperators: ["eq", "gte", "lte", "isEmpty", "isNotEmpty"],
  sortable: true,
  creatable: true,
  Cell: ({ value }) => {
    const intake = toIntake(value)
    return intake ? (
      <span>{formatIntake(intake, getCurrentLanguage())}</span>
    ) : (
      <EmptyValue />
    )
  },
  Input: lazyFieldInput(() =>
    import("./inputs").then((module) => module.IntakeInput)
  ),
}
