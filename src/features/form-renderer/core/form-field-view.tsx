import { EyeOffIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
import {
  getAnswerType,
  getFormFieldCategory,
  toEngineFieldDef,
  type FormField,
} from "@/engine/forms"
import type { Language } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"
import { cn } from "@/lib/utils"

import { CheckboxGroupInput, ConsentInput, RadioGroupInput } from "./inputs"

/** Types that always take the full row (multi-line, repeating rows, groups). */
const WIDE_TYPES = new Set([
  "textarea",
  "file",
  "container",
  "dimensions",
  "radio",
  "checkboxes",
  "consent",
  "heading",
  "paragraph",
  "divider",
  "hidden",
])

export function isWideField(field: FormField) {
  return field.width === "full" || WIDE_TYPES.has(field.type)
}

export const formInputId = (idPrefix: string, field: FormField) =>
  `${idPrefix}-${field.key}`

export interface FormFieldViewProps {
  field: FormField
  language: Language
  idPrefix: string
  required: boolean
  value?: unknown
  onChange?: (value: unknown) => void
  onBlur?: () => void
  error?: string
  /**
   * `false` renders the field as a non-focusable picture of itself (builder
   * canvas); hidden fields are then shown as a placeholder chip.
   */
  interactive?: boolean
  className?: string
}

/**
 * One form field: label, input, help text and error (plan B4.1). The same
 * view renders the builder canvas, the preview and the public form.
 */
export function FormFieldView({
  field,
  language,
  idPrefix,
  required,
  value,
  onChange = () => {},
  onBlur,
  error,
  interactive = true,
  className,
}: FormFieldViewProps) {
  const { t } = useTranslation("renderer", { lng: language })
  const category = getFormFieldCategory(field.type)
  const text = (value?: { tr: string; en: string }) =>
    value ? resolveI18nText(value, language) : ""
  const wide = cn(isWideField(field) && "@sm:col-span-2", className)

  if (category === "layout") {
    if (field.type === "divider") return <Separator className={wide} />
    if (field.type === "heading") {
      return (
        <div className={cn("flex flex-col gap-1", wide)}>
          <h3 className="text-lg font-semibold">{text(field.label)}</h3>
          {field.content ? (
            <p className="text-sm text-muted-foreground">
              {text(field.content)}
            </p>
          ) : null}
        </div>
      )
    }
    return (
      <p className={cn("text-sm whitespace-pre-line", wide)}>
        {text(field.content) || text(field.label)}
      </p>
    )
  }

  if (category === "hidden") {
    if (interactive) return null
    const prefill = field.prefill
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-sm text-muted-foreground",
          wide
        )}
      >
        <EyeOffIcon className="size-4" aria-hidden />
        <span className="font-medium">{t("hiddenField")}</span>
        <span className="truncate">
          {text(field.label)}
          {prefill
            ? ` · ${t(`prefill.${prefill.kind}`, { param: prefill.param ?? "" })}`
            : null}
        </span>
      </div>
    )
  }

  const inputId = formInputId(idPrefix, field)
  const labelId = `${inputId}-label`
  const errorId = `${inputId}-error`
  const helpId = `${inputId}-help`
  const describedBy =
    [error ? errorId : null, field.helpText ? helpId : null]
      .filter(Boolean)
      .join(" ") || undefined
  const common = {
    id: inputId,
    onBlur,
    invalid: !!error,
    describedBy,
  }
  const placeholder = text(field.placeholder) || undefined

  const help = field.helpText ? (
    <FieldDescription id={helpId}>{text(field.helpText)}</FieldDescription>
  ) : null
  const errorView = error ? (
    <FieldError id={errorId} errors={[{ message: error }]} />
  ) : null

  if (field.type === "consent") {
    return (
      <div
        className={cn("flex flex-col gap-2", wide)}
        inert={!interactive || undefined}
      >
        <ConsentInput
          {...common}
          field={field}
          language={language}
          value={value as boolean | null}
          onChange={onChange}
          required={required}
        />
        {help}
        {errorView}
      </div>
    )
  }

  const requiredMark = required ? (
    <>
      <span aria-hidden className="text-destructive">
        *
      </span>
      <span className="sr-only">({t("required")})</span>
    </>
  ) : null

  let input
  if (field.type === "radio" || field.type === "checkboxes") {
    const Group = field.type === "radio" ? RadioGroupInput : CheckboxGroupInput
    input = (
      <Group
        {...common}
        field={field}
        language={language}
        labelledBy={labelId}
        // Each group renders its own value shape.
        value={value as never}
        onChange={onChange}
      />
    )
  } else {
    const definition = getAnswerType(field)
    input = (
      <definition.Input
        {...common}
        labelId={labelId}
        field={toEngineFieldDef(field, { required })}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    )
  }

  const grouped = field.type === "radio" || field.type === "checkboxes"
  return (
    <Field
      data-invalid={error ? true : undefined}
      className={wide}
      inert={!interactive || undefined}
    >
      {grouped ? (
        <div id={labelId} className="flex gap-1 text-sm font-medium">
          {text(field.label)}
          {requiredMark}
        </div>
      ) : (
        <FieldLabel htmlFor={inputId} id={labelId}>
          {text(field.label)}
          {requiredMark}
        </FieldLabel>
      )}
      {input}
      {help}
      {errorView}
    </Field>
  )
}
