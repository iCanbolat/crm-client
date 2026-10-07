import type { ObjectDef } from "../metadata/schemas"
import { getAnswerFields, isInputField } from "./kinds"
import {
  detectLogicCycles,
  findBrokenLogicRefs,
  findIncompleteRules,
} from "./logic"
import { validateMapping, type MappingIssueCode } from "./mapping"
import type { FormContent } from "./schemas"
import { getThemeWarnings } from "./theme"
import { getMissingTranslations } from "./translations"

/**
 * Publish check of a form (plan B4.7). Errors block publishing (the mock
 * API answers 422 with the same list); warnings are shown for confirmation.
 */

export type FormIssueCode =
  | "noInputs"
  | "duplicateKey"
  | "logicCycle"
  | "logicBroken"
  | "logicIncomplete"
  | "invalidRedirect"
  | MappingIssueCode
  | "missingTranslation"
  | "lowContrast"

export interface FormIssue {
  code: FormIssueCode
  severity: "error" | "warning"
  fieldId?: string
  ruleId?: string
  /** Target field key (mapping issues). */
  target?: string
  /** Number of affected texts / colors (aggregated warnings). */
  count?: number
}

/** postMessage type the embedded form sends with its height (Faz 5). */
export const FORM_EMBED_RESIZE_MESSAGE = "crm-form:resize"

/** Redirect targets must be https pages (no `javascript:` or plain http). */
export function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:"
  } catch {
    return false
  }
}

export function validateFormForPublish(
  content: FormContent,
  objectDef: ObjectDef | undefined
): FormIssue[] {
  const issues: FormIssue[] = []
  const error = (issue: Omit<FormIssue, "severity">) =>
    issues.push({ ...issue, severity: "error" })

  if (!content.fields.some(isInputField)) error({ code: "noInputs" })

  const seen = new Set<string>()
  for (const field of getAnswerFields(content)) {
    if (seen.has(field.key)) error({ code: "duplicateKey", fieldId: field.id })
    seen.add(field.key)
  }

  for (const cycle of detectLogicCycles(content)) {
    error({ code: "logicCycle", fieldId: cycle[0] })
  }
  const broken = new Set(
    findBrokenLogicRefs(content).map((item) => item.ruleId)
  )
  for (const ruleId of broken) error({ code: "logicBroken", ruleId })
  for (const ruleId of findIncompleteRules(content)) {
    if (!broken.has(ruleId)) error({ code: "logicIncomplete", ruleId })
  }

  const redirect = content.settings.redirectUrl
  if (redirect && !isHttpsUrl(redirect)) error({ code: "invalidRedirect" })

  if (objectDef) {
    for (const issue of validateMapping(content, objectDef)) error(issue)
  } else {
    error({ code: "unknownTarget" })
  }

  const missing = getMissingTranslations(content)
  if (missing.length) {
    issues.push({
      code: "missingTranslation",
      severity: "warning",
      count: missing.length,
    })
  }
  const contrast = getThemeWarnings(content.theme)
  if (contrast.length) {
    issues.push({
      code: "lowContrast",
      severity: "warning",
      count: contrast.length,
    })
  }
  return issues
}

export const hasBlockingIssues = (issues: readonly FormIssue[]) =>
  issues.some((issue) => issue.severity === "error")
