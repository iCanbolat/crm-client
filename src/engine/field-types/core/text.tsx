import { AlignLeftIcon, AtSignIcon, LinkIcon, TypeIcon } from "lucide-react"
import { z } from "zod"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import type { FieldDef } from "../../metadata/schemas"
import type {
  FieldCellProps,
  FieldInputProps,
  FieldTypeDefinition,
} from "../types"
import { EmptyValue } from "../ui"
import {
  inputA11yProps,
  isBlank,
  message,
  patternOf,
  textComparable,
} from "./shared"

const TEXT_OPERATORS = [
  "contains",
  "notContains",
  "eq",
  "neq",
  "startsWith",
  "isEmpty",
  "isNotEmpty",
] as const

function textSchema(field: FieldDef) {
  let schema = z.string().trim()
  const { min, max } = field.validation ?? {}
  if (min !== undefined) schema = schema.min(min, message.min(min))
  if (max !== undefined) schema = schema.max(max, message.max(max))
  const pattern = patternOf(field)
  if (pattern) schema = schema.regex(pattern, message.pattern)
  return schema
}

const toText = (value: string) => (value === "" ? null : value)

function TextCell({ value }: FieldCellProps<string>) {
  if (isBlank(value)) return <EmptyValue />
  return <span className="block max-w-xs truncate">{value}</span>
}

function makeTextInput(type: "text" | "email" | "url") {
  return function TextInput(props: FieldInputProps<string>) {
    return (
      <Input
        {...inputA11yProps(props)}
        type={type}
        inputMode={type === "url" ? "url" : undefined}
        autoComplete="off"
        value={props.value ?? ""}
        onChange={(event) => props.onChange(toText(event.target.value))}
      />
    )
  }
}

export const textFieldType: FieldTypeDefinition<string> = {
  type: "text",
  icon: TypeIcon,
  toZod: textSchema,
  isEmpty: isBlank,
  toComparable: textComparable,
  format: (value) => value,
  filterOperators: TEXT_OPERATORS,
  sortable: true,
  creatable: true,
  Cell: TextCell,
  Input: makeTextInput("text"),
}

export const textareaFieldType: FieldTypeDefinition<string> = {
  type: "textarea",
  icon: AlignLeftIcon,
  toZod: textSchema,
  isEmpty: isBlank,
  toComparable: textComparable,
  format: (value) => value,
  filterOperators: ["contains", "notContains", "isEmpty", "isNotEmpty"],
  sortable: false,
  creatable: true,
  Cell: ({ value }) =>
    isBlank(value) ? (
      <EmptyValue />
    ) : (
      <span className="line-clamp-2 max-w-sm whitespace-pre-line">{value}</span>
    ),
  Input: (props) => (
    <Textarea
      {...inputA11yProps(props)}
      rows={4}
      value={props.value ?? ""}
      onChange={(event) => props.onChange(toText(event.target.value))}
    />
  ),
}

export const emailFieldType: FieldTypeDefinition<string> = {
  type: "email",
  icon: AtSignIcon,
  toZod: () => z.string().trim().toLowerCase().pipe(z.email(message.email)),
  isEmpty: isBlank,
  toComparable: textComparable,
  format: (value) => value,
  filterOperators: TEXT_OPERATORS,
  sortable: true,
  creatable: true,
  Cell: ({ value }) =>
    isBlank(value) ? (
      <EmptyValue />
    ) : (
      <a
        href={`mailto:${value}`}
        className="text-primary underline-offset-4 hover:underline"
        onClick={(event) => event.stopPropagation()}
      >
        {value}
      </a>
    ),
  Input: makeTextInput("email"),
}

/** "acme.com" → "https://acme.com"; anything with a scheme is kept. */
export function normalizeUrl(value: unknown) {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  return trimmed && !/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? `https://${trimmed}`
    : trimmed
}

function displayUrl(value: string) {
  try {
    const url = new URL(value)
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`
  } catch {
    return value
  }
}

export const urlFieldType: FieldTypeDefinition<string> = {
  type: "url",
  icon: LinkIcon,
  toZod: () =>
    z.preprocess(
      normalizeUrl,
      z.url({ protocol: /^https?$/, ...message.url })
    ) as unknown as z.ZodType<string>,
  isEmpty: isBlank,
  toComparable: textComparable,
  format: (value) => displayUrl(value),
  filterOperators: ["contains", "eq", "isEmpty", "isNotEmpty"],
  sortable: true,
  creatable: true,
  Cell: ({ value }) =>
    isBlank(value) || !value ? (
      <EmptyValue />
    ) : (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="text-primary underline-offset-4 hover:underline"
        onClick={(event) => event.stopPropagation()}
      >
        {displayUrl(value)}
      </a>
    ),
  Input: makeTextInput("url"),
}
