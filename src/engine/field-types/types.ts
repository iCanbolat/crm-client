import type { LucideIcon } from "lucide-react"
import type { ComponentType } from "react"
import type { z } from "zod"

import type { Language } from "@/lib/i18n"

import type { Comparable, FilterOperator } from "../logic/conditions"
import type { FieldDef, FieldType, RecordRef } from "../metadata/schemas"
import type { FieldServices } from "./services"

export interface FormatContext {
  field: FieldDef
  language: Language
  /** Label of a referenced record/user (relation and user fields). */
  refValue?: RecordRef | null
}

export interface FieldCellProps<V = unknown> {
  field: FieldDef
  value: V | null | undefined
  refValue?: RecordRef | null
}

export interface FieldInputProps<V = unknown> {
  id: string
  field: FieldDef
  value: V | null | undefined
  onChange: (value: V | null) => void
  onBlur?: () => void
  invalid?: boolean
  /** Id of the element describing the input (error message). */
  describedBy?: string
  disabled?: boolean
  autoFocus?: boolean
  /** Initial label of a relation/user value. */
  refValue?: RecordRef | null
  /** Reports the label of a newly picked relation value. */
  onRefChange?: (ref: RecordRef | null) => void
  /** Id of the visible label (for widgets `<label for>` cannot name). */
  labelId?: string
  /** Accessible name when no visible label exists (inline edit, filters). */
  ariaLabel?: string
}

export interface FieldOption {
  value: string
  label: string
}

/**
 * Everything the engine needs to know about a field type (plan §4.4).
 * Sector modules register additional definitions (B3.2).
 */
export interface FieldTypeDefinition<V = unknown> {
  type: FieldType
  icon: LucideIcon
  /** Schema of a non-empty value; required/optional is added by the engine. */
  toZod(field: FieldDef): z.ZodType<V>
  isEmpty(value: unknown): boolean
  /** Value used for sorting and filtering (lists, mock API). */
  toComparable(value: unknown): Comparable
  /** Plain text representation (search, export, kanban cards, toasts). */
  format(value: V, context: FormatContext): string
  filterOperators: readonly FilterOperator[]
  sortable: boolean
  /** Enumerable values, used by `in`/`notIn` filters. */
  getOptions?(
    field: FieldDef,
    context: { language: Language; services: FieldServices }
  ): FieldOption[]
  /** Creating the field needs a picklist / a target object. */
  config?: "options" | "relation"
  /** Offered when admins add a custom field. */
  creatable: boolean
  Cell: ComponentType<FieldCellProps<V>>
  Input: ComponentType<FieldInputProps<V>>
}

// Registry entries are heterogeneous; values are `unknown` at call sites.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFieldTypeDefinition = FieldTypeDefinition<any>
