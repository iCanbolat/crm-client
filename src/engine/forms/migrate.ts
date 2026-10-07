import { z } from "zod"

import { toFieldKey } from "../metadata/helpers"
import { FIELD_KEY_PATTERN } from "../metadata/schemas"
import {
  createDefaultMapping,
  createDefaultSettings,
  DEFAULT_FORM_THEME,
  FIRST_STEP_ID,
} from "./defaults"
import {
  FORM_SCHEMA_VERSION,
  formContentSchema,
  HEX_COLOR_PATTERN,
  type FormContent,
  type FormField,
} from "./schemas"

/** Stored content of an unsupported (newer / unknown) schema version. */
export class FormSchemaError extends Error {
  readonly version: unknown

  constructor(version: unknown) {
    super(`Unsupported form schema version: ${String(version)}`)
    this.name = "FormSchemaError"
    this.version = version
  }
}

/**
 * Schema v1 — the first prototype format: no `schemaVersion`, no steps or
 * rules, Turkish-only plain-text labels, option lists as strings and a
 * single theme color. Forms saved in it stay readable (TC-4.1-03).
 */
const v1FieldSchema = z.object({
  key: z.string().min(1),
  type: z.string().min(1),
  label: z.string(),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
})

const v1ContentSchema = z.object({
  schemaVersion: z.literal(1).optional(),
  fields: z.array(v1FieldSchema),
  submitLabel: z.string().optional(),
  successMessage: z.string().optional(),
  theme: z.object({ color: z.string().optional() }).optional(),
})

const tr = (text: string) => ({ tr: text, en: "" })

function migrateV1(raw: z.infer<typeof v1ContentSchema>): FormContent {
  const taken = new Set<string>()
  const fields: FormField[] = raw.fields.map((field, index) => {
    const base = FIELD_KEY_PATTERN.test(field.key)
      ? field.key
      : toFieldKey(field.key) || `field${index + 1}`
    let key = base
    for (let n = 2; taken.has(key); n += 1) key = `${base}${n}`
    taken.add(key)
    return {
      id: `fld_${key}`,
      key,
      type: field.type,
      stepId: FIRST_STEP_ID,
      label: tr(field.label),
      ...(field.placeholder ? { placeholder: tr(field.placeholder) } : {}),
      required: field.required ?? false,
      width: "full" as const,
      ...(field.options
        ? {
            options: field.options.map((option, optionIndex) => ({
              value: toFieldKey(option) || `option${optionIndex + 1}`,
              label: tr(option),
            })),
          }
        : {}),
    }
  })

  const settings = createDefaultSettings()
  const color = raw.theme?.color
  return {
    schemaVersion: FORM_SCHEMA_VERSION,
    steps: [{ id: FIRST_STEP_ID, title: tr("") }],
    fields,
    logic: [],
    mapping: createDefaultMapping(),
    settings: {
      ...settings,
      // v1 forms were Turkish only.
      languages: ["tr"],
      submitLabel: raw.submitLabel ? tr(raw.submitLabel) : settings.submitLabel,
      successMessage: raw.successMessage
        ? tr(raw.successMessage)
        : settings.successMessage,
    },
    theme: {
      ...DEFAULT_FORM_THEME,
      ...(color && HEX_COLOR_PATTERN.test(color)
        ? { primaryColor: color }
        : {}),
    },
  }
}

/**
 * Reads stored form content of any supported schema version and returns it
 * in the current one. Throws `FormSchemaError` for unknown versions and zod
 * errors for malformed content.
 */
export function migrateFormContent(raw: unknown): FormContent {
  const version =
    typeof raw === "object" && raw !== null && "schemaVersion" in raw
      ? (raw as { schemaVersion: unknown }).schemaVersion
      : 1
  if (version === FORM_SCHEMA_VERSION) return formContentSchema.parse(raw)
  if (version === 1) return migrateV1(v1ContentSchema.parse(raw))
  throw new FormSchemaError(version)
}
