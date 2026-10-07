import { ExternalLinkIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { FormField } from "@/engine/forms"
import type { Language } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"

/** Inputs of the palette types without an engine counterpart widget. */

interface ChoiceInputProps<V> {
  id: string
  field: FormField
  language: Language
  value: V | null | undefined
  onChange: (value: V | null) => void
  onBlur?: () => void
  invalid?: boolean
  describedBy?: string
  labelledBy: string
  disabled?: boolean
}

function options(field: FormField, language: Language) {
  return (field.options ?? []).map((option) => ({
    value: option.value,
    label: resolveI18nText(option.label, language),
  }))
}

export function RadioGroupInput(props: ChoiceInputProps<string>) {
  return (
    <RadioGroup
      name={props.id}
      value={props.value ?? null}
      onValueChange={(next) =>
        props.onChange(typeof next === "string" ? next : null)
      }
      aria-labelledby={props.labelledBy}
      aria-describedby={props.describedBy}
      aria-invalid={props.invalid ? true : undefined}
      disabled={props.disabled}
      className="gap-2"
    >
      {options(props.field, props.language).map((item) => (
        <Field key={item.value} orientation="horizontal">
          <RadioGroupItem
            value={item.value}
            id={`${props.id}-${item.value}`}
            onBlur={props.onBlur}
          />
          <FieldLabel
            htmlFor={`${props.id}-${item.value}`}
            className="font-normal"
          >
            {item.label}
          </FieldLabel>
        </Field>
      ))}
    </RadioGroup>
  )
}

export function CheckboxGroupInput(props: ChoiceInputProps<string[]>) {
  const items = options(props.field, props.language)
  const selected = Array.isArray(props.value) ? props.value : []

  function toggle(value: string, checked: boolean) {
    const next = checked
      ? [...selected, value]
      : selected.filter((item) => item !== value)
    const ordered = items
      .map((item) => item.value)
      .filter((item) => next.includes(item))
    props.onChange(ordered.length ? ordered : null)
  }

  return (
    <div
      role="group"
      aria-labelledby={props.labelledBy}
      aria-describedby={props.describedBy}
      className="grid gap-2"
    >
      {items.map((item) => (
        <Field key={item.value} orientation="horizontal">
          <Checkbox
            id={`${props.id}-${item.value}`}
            checked={selected.includes(item.value)}
            onCheckedChange={(checked) => toggle(item.value, checked === true)}
            onBlur={props.onBlur}
            disabled={props.disabled}
            aria-invalid={props.invalid ? true : undefined}
          />
          <FieldLabel
            htmlFor={`${props.id}-${item.value}`}
            className="font-normal"
          >
            {item.label}
          </FieldLabel>
        </Field>
      ))}
    </div>
  )
}

interface ConsentInputProps extends Omit<
  ChoiceInputProps<boolean>,
  "labelledBy"
> {
  required: boolean
}

/** KVKK / GDPR consent: the label is the statement being accepted. */
export function ConsentInput(props: ConsentInputProps) {
  const { t } = useTranslation("renderer", { lng: props.language })
  const { field, language } = props
  const detail = field.content ? resolveI18nText(field.content, language) : ""

  return (
    <Field orientation="horizontal" className="items-start">
      <Checkbox
        id={props.id}
        checked={props.value === true}
        onCheckedChange={(checked) => props.onChange(checked === true)}
        onBlur={props.onBlur}
        disabled={props.disabled}
        aria-invalid={props.invalid ? true : undefined}
        aria-describedby={props.describedBy}
        className="mt-0.5"
      />
      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor={props.id} className="leading-snug font-normal">
          <span>
            {resolveI18nText(field.label, language)}
            {props.required ? (
              <>
                <span aria-hidden className="text-destructive">
                  {" "}
                  *
                </span>
                <span className="sr-only"> ({t("required")})</span>
              </>
            ) : null}
          </span>
        </FieldLabel>
        {detail ? (
          <p className="text-xs text-muted-foreground">{detail}</p>
        ) : null}
        {field.consentUrl ? (
          <a
            href={field.consentUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex w-fit items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
          >
            {t("consentLink")}
            <ExternalLinkIcon className="size-3" aria-hidden />
          </a>
        ) : null}
      </div>
    </Field>
  )
}
