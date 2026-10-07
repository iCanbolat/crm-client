import { z } from "zod"

import i18n from "@/lib/i18n"

import { getFieldType } from "../field-types/registry"
import { getEditableFields, pickFields } from "../metadata/helpers"
import type { FieldDef, ObjectDef, RecordValues } from "../metadata/schemas"
import { isFieldVisible } from "./visibility"

export interface MetadataToZodOptions {
  /** Restrict to these fields (inline edit, stage gate dialog). */
  fields?: readonly string[]
  /**
   * PATCH semantics: missing keys are allowed, but a required field that is
   * sent must not be emptied.
   */
  partial?: boolean
  /**
   * Stored values the input is merged into (PATCH): conditional fields are
   * evaluated against the merged record.
   */
  current?: RecordValues
}

const required = { error: () => i18n.t("engine:validation.required") }

/**
 * Input that means "no value" for every type. Deliberately not the type's
 * own `isEmpty`: a value of the wrong type must fail validation, not be
 * silently cleared.
 */
export function isEmptyInput(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (typeof value === "number" && Number.isNaN(value)) ||
    (Array.isArray(value) && value.length === 0)
  )
}

/**
 * Schema of one field value. Empty input (`""`, `[]`, `NaN`, …) becomes
 * `null`, which clears the value; required fields reject it.
 */
export function fieldToZod(field: FieldDef, { partial = false } = {}) {
  const definition = getFieldType(field.type)
  const schema = z.preprocess(
    (value) => (isEmptyInput(value) ? null : value),
    definition.toZod(field).nullable()
  )

  // Conditional fields are required only while visible (object level check).
  if (!field.required || field.visibleWhen?.length) return schema.optional()

  const requiredSchema = schema.refine(
    (value) => value !== null && value !== undefined,
    required
  )
  return partial ? requiredSchema.optional() : requiredSchema
}

/** Form / API schema generated from object metadata (B2.1). */
export function metadataToZod(
  objectDef: ObjectDef,
  options: MetadataToZodOptions = {}
): z.ZodType<RecordValues, RecordValues> {
  const fields = options.fields
    ? pickFields(objectDef, options.fields).filter((field) => !field.readOnly)
    : getEditableFields(objectDef)

  const shape: Record<string, z.ZodType> = {}
  for (const field of fields) {
    shape[field.key] = fieldToZod(field, options)
  }

  const object = z.object(shape)
  if (!fields.some((field) => field.visibleWhen?.length)) return object

  const conditional = fields.filter(
    (field) => field.required && field.visibleWhen?.length
  )
  // Hidden fields are ignored (a stale, invalid value must not block the
  // form) and visible required ones are enforced.
  return z.preprocess(
    (input) => {
      if (typeof input !== "object" || input === null) return input
      const values = input as RecordValues
      const merged = { ...options.current, ...values }
      const result = { ...values }
      for (const field of fields) {
        if (
          field.visibleWhen?.length &&
          field.key in result &&
          !isFieldVisible(objectDef, field, merged)
        ) {
          result[field.key] = null
        }
      }
      return result
    },
    object.superRefine((data, context) => {
      const input = data as RecordValues
      const values = { ...options.current, ...input }
      for (const field of conditional) {
        // PATCH: only fields that are sent (a partial edit elsewhere must not
        // fail on an unrelated hidden field).
        if (options.partial && !(field.key in input)) continue
        if (!isFieldVisible(objectDef, field, values)) continue
        if (!isEmptyInput(values[field.key])) continue
        context.addIssue({
          code: "custom",
          path: [field.key],
          message: i18n.t("engine:validation.required"),
        })
      }
    })
  )
}

export type RecordInput = Record<string, unknown>
