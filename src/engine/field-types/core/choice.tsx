import {
  CheckIcon,
  CircleDotIcon,
  ListChecksIcon,
  ToggleLeftIcon,
  XIcon,
} from "lucide-react"
import { z } from "zod"

import { Checkbox } from "@/components/ui/checkbox"
import i18n, { type Language } from "@/lib/i18n"

import { getOptionLabel, label } from "../../metadata/helpers"
import type { FieldDef } from "../../metadata/schemas"
import type { FieldInputProps, FieldTypeDefinition } from "../types"
import { lazyFieldInput } from "../lazy"
import { EmptyValue, OptionBadge } from "../ui"
import { isBlank, message } from "./shared"

function optionValues(field: FieldDef) {
  return (field.options ?? []).map((option) => option.value)
}

export function optionItems(field: FieldDef, language: Language) {
  return (field.options ?? []).map((option) => ({
    value: option.value,
    label: label(option.label, language),
  }))
}

/* ---------------------------------------------------------------- boolean */

function BooleanInput(props: FieldInputProps<boolean>) {
  return (
    <Checkbox
      id={props.id}
      checked={props.value === true}
      onCheckedChange={(checked) => props.onChange(checked === true)}
      onBlur={props.onBlur}
      disabled={props.disabled}
      aria-invalid={props.invalid ? true : undefined}
      aria-describedby={props.describedBy}
      aria-labelledby={props.labelId}
      aria-label={props.labelId ? undefined : props.ariaLabel}
    />
  )
}

export const booleanFieldType: FieldTypeDefinition<boolean> = {
  type: "boolean",
  icon: ToggleLeftIcon,
  toZod: () => z.boolean(),
  isEmpty: (value) => typeof value !== "boolean",
  toComparable: (value) => (typeof value === "boolean" ? value : null),
  format: (value, { language }) =>
    i18n.getFixedT(language, "engine")(value ? "yes" : "no"),
  filterOperators: ["isTrue", "isFalse"],
  sortable: true,
  creatable: true,
  Cell: ({ value }) => {
    if (typeof value !== "boolean") return <EmptyValue />
    const text = i18n.t(value ? "engine:yes" : "engine:no")
    return (
      <span className="inline-flex items-center gap-1">
        {value ? (
          <CheckIcon className="size-4 text-primary" aria-hidden />
        ) : (
          <XIcon className="size-4 text-muted-foreground" aria-hidden />
        )}
        {text}
      </span>
    )
  },
  Input: BooleanInput,
}

/* ----------------------------------------------------------------- select */

export const selectFieldType: FieldTypeDefinition<string> = {
  type: "select",
  icon: CircleDotIcon,
  toZod: (field) =>
    z
      .string()
      .refine((value) => optionValues(field).includes(value), message.option),
  isEmpty: isBlank,
  toComparable: (value) => (isBlank(value) ? null : String(value)),
  format: (value, { field, language }) =>
    getOptionLabel(field, value, language),
  filterOperators: ["in", "notIn", "isEmpty", "isNotEmpty"],
  sortable: true,
  getOptions: (field, { language }) => optionItems(field, language),
  config: "options",
  creatable: true,
  Cell: ({ field, value }) =>
    isBlank(value) || !value ? (
      <EmptyValue />
    ) : (
      <OptionBadge field={field} value={value} />
    ),
  Input: lazyFieldInput(() =>
    import("./inputs").then((module) => module.SelectInput)
  ),
}

/* ------------------------------------------------------------ multiselect */

export const toList = (value: unknown) =>
  Array.isArray(value) ? value.filter((item) => typeof item === "string") : []

export const multiselectFieldType: FieldTypeDefinition<string[]> = {
  type: "multiselect",
  icon: ListChecksIcon,
  toZod: (field) =>
    z
      .array(z.string())
      .refine(
        (values) =>
          values.every((value) => optionValues(field).includes(value)),
        message.option
      ),
  isEmpty: (value) => toList(value).length === 0,
  toComparable: (value) => {
    const list = toList(value)
    return list.length ? list : null
  },
  format: (value, { field, language }) =>
    toList(value)
      .map((item) => getOptionLabel(field, item, language))
      .join(", "),
  filterOperators: ["in", "notIn", "isEmpty", "isNotEmpty"],
  sortable: false,
  getOptions: (field, { language }) => optionItems(field, language),
  config: "options",
  creatable: true,
  Cell: ({ field, value }) => {
    const list = toList(value)
    if (list.length === 0) return <EmptyValue />
    return (
      <span className="flex flex-wrap gap-1">
        {list.map((item) => (
          <OptionBadge key={item} field={field} value={item} />
        ))}
      </span>
    )
  },
  Input: lazyFieldInput(() =>
    import("./inputs").then((module) => module.MultiSelectInput)
  ),
}
