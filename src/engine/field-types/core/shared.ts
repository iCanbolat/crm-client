import i18n from "@/lib/i18n"

import type { FieldDef } from "../../metadata/schemas"

import type { FieldInputProps } from "../types"

export function isBlank(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  )
}

export const textComparable = (value: unknown) =>
  isBlank(value) ? null : String(value)

/** zod `error` option resolved at parse time, in the current language. */
export const message = {
  phone: { error: () => i18n.t("engine:validation.phone") },
  url: { error: () => i18n.t("engine:validation.url") },
  email: { error: () => i18n.t("engine:validation.email") },
  pattern: { error: () => i18n.t("engine:validation.pattern") },
  option: { error: () => i18n.t("engine:validation.option") },
  country: { error: () => i18n.t("engine:validation.country") },
  required: { error: () => i18n.t("engine:validation.required") },
  min: (min: number) => ({
    error: () => i18n.t("engine:validation.min", { min }),
  }),
  max: (max: number) => ({
    error: () => i18n.t("engine:validation.max", { max }),
  }),
}

/** Native input props shared by every field input. */
export function inputA11yProps<V>(props: FieldInputProps<V>) {
  return {
    id: props.id,
    disabled: props.disabled,
    autoFocus: props.autoFocus,
    onBlur: props.onBlur,
    "aria-invalid": props.invalid ? true : undefined,
    "aria-describedby": props.describedBy,
    "aria-label": props.ariaLabel,
    placeholder: props.placeholder,
  } as const
}

export function patternOf(field: FieldDef) {
  const pattern = field.validation?.pattern
  if (!pattern) return undefined
  try {
    return new RegExp(pattern)
  } catch {
    return undefined
  }
}
