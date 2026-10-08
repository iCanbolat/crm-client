import { formatFieldValue } from "../field-types/registry"
import { getField } from "../metadata/helpers"
import type { CrmRecord, ObjectDef } from "../metadata/schemas"
import type { MessageTemplateDef, TemplateLanguage } from "./types"

export interface TemplateContext {
  /** Record the message is about; without it `field` variables stay empty. */
  objectDef?: ObjectDef
  record?: CrmRecord
  recipientName?: string | null
  workspaceName?: string | null
  /** Data of the triggering event (`event` variables). */
  eventData?: Record<string, string>
}

export interface ResolvedParams {
  /** Value of `{{n}}` at index `n - 1`; "" when unknown. */
  params: string[]
  /** 1-based numbers of variables without a value. */
  missing: number[]
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? ""

/**
 * Fills a template's variables from the record it is about. Field values are
 * formatted with their field type (dates, locations, money) in the
 * template's language, exactly as the record page shows them.
 */
export function resolveTemplateParams(
  def: MessageTemplateDef,
  context: TemplateContext,
  language: TemplateLanguage
): ResolvedParams {
  const params = def.variables.map((variable) => {
    const { source } = variable
    switch (source.kind) {
      case "recipient": {
        const name = context.recipientName?.trim() ?? ""
        return source.field === "firstName" ? firstName(name) : name
      }
      case "workspace":
        return context.workspaceName?.trim() ?? ""
      case "event":
        return context.eventData?.[source.field]?.trim() ?? ""
      case "field": {
        const { objectDef, record } = context
        const field = objectDef && getField(objectDef, source.field)
        if (!field || !record) return ""
        return formatFieldValue(field, record.values[field.key], {
          language,
          refValue: record.refs[field.key] ?? null,
        }).trim()
      }
    }
  })
  const missing = params.flatMap((value, index) => (value ? [] : [index + 1]))
  return { params, missing }
}
