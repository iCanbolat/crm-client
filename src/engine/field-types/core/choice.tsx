import {
  CheckIcon,
  ChevronDownIcon,
  CircleDotIcon,
  ListChecksIcon,
  ToggleLeftIcon,
  XIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import i18n, { getCurrentLanguage, type Language } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { getOptionLabel, label } from "../../metadata/helpers"
import type { FieldDef } from "../../metadata/schemas"
import type { FieldInputProps, FieldTypeDefinition } from "../types"
import { EmptyValue, OptionBadge } from "../ui"
import { isBlank, message } from "./shared"

function optionValues(field: FieldDef) {
  return (field.options ?? []).map((option) => option.value)
}

function optionItems(field: FieldDef, language: Language) {
  return (field.options ?? []).map((option) => ({
    value: option.value,
    label: label(option.label, language),
  }))
}

/* ---------------------------------------------------------------- boolean */

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
  Input: (props: FieldInputProps<boolean>) => (
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
  ),
}

/* ----------------------------------------------------------------- select */

function SelectInput(props: FieldInputProps<string>) {
  const { t } = useTranslation("engine")
  const language = getCurrentLanguage()
  const options = optionItems(props.field, language)
  const items = props.field.required
    ? options
    : [{ value: null, label: t("none") }, ...options]

  return (
    <Select
      items={items}
      value={props.value ?? null}
      onValueChange={(next) =>
        props.onChange(typeof next === "string" ? next : null)
      }
      disabled={props.disabled}
    >
      <SelectTrigger
        id={props.id}
        className="w-full"
        onBlur={props.onBlur}
        aria-invalid={props.invalid ? true : undefined}
        aria-describedby={props.describedBy}
        aria-label={props.labelId ? undefined : props.ariaLabel}
        autoFocus={props.autoFocus}
      >
        <SelectValue placeholder={t("input.selectPlaceholder")} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value ?? "__none"} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

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
  Input: SelectInput,
}

/* ------------------------------------------------------------ multiselect */

const toList = (value: unknown) =>
  Array.isArray(value) ? value.filter((item) => typeof item === "string") : []

function MultiSelectInput(props: FieldInputProps<string[]>) {
  const { t } = useTranslation("engine")
  const language = getCurrentLanguage()
  const selected = toList(props.value)
  const items = optionItems(props.field, language)

  function toggle(value: string, checked: boolean) {
    const next = checked
      ? [...selected, value]
      : selected.filter((item) => item !== value)
    // Keep the option order of the field definition.
    const ordered = items
      .map((item) => item.value)
      .filter((item) => next.includes(item))
    props.onChange(ordered.length ? ordered : null)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            id={props.id}
            type="button"
            variant="outline"
            disabled={props.disabled}
            onBlur={props.onBlur}
            aria-invalid={props.invalid ? true : undefined}
            aria-describedby={props.describedBy}
            aria-labelledby={
              props.labelId ? `${props.labelId} ${props.id}` : undefined
            }
            aria-label={props.labelId ? undefined : props.ariaLabel}
            className={cn(
              "h-auto min-h-9 w-full justify-between rounded-3xl py-1.5 font-normal",
              selected.length === 0 && "text-muted-foreground"
            )}
          />
        }
      >
        <span className="flex flex-wrap gap-1">
          {selected.length === 0
            ? t("input.selectPlaceholder")
            : selected.map((value) => (
                <OptionBadge key={value} field={props.field} value={value} />
              ))}
        </span>
        <ChevronDownIcon className="text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        {items.map((item) => (
          <DropdownMenuCheckboxItem
            key={item.value}
            checked={selected.includes(item.value)}
            onCheckedChange={(checked) => toggle(item.value, checked)}
          >
            {item.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

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
  Input: MultiSelectInput,
}
