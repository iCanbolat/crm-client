import { formatFieldValue } from "@/engine/field-types"
import {
  getAnswerFields,
  migrateFormContent,
  toEngineFieldDef,
  type FormContent,
} from "@/engine/forms"
import { getRecordRef } from "@/features/records/mocks/store"
import { resolveI18nText } from "@/lib/i18n-text"
import type { Language } from "@/lib/i18n"
import { db } from "@/mocks/db"

import type { Submission, SubmissionSummary } from "../api/submissions.schemas"
import type { SubmissionRow } from "./types"

export function submissionsOf(workspaceId: string) {
  return db.submissions.findMany((row) => row.workspaceId === workspaceId)
}

export function findSubmissionRow(workspaceId: string, id: string) {
  const row = db.submissions.findById(id)
  return row && row.workspaceId === workspaceId ? row : undefined
}

/** Content of the form version the submission was made with. */
export function submissionContent(row: SubmissionRow): FormContent | undefined {
  const version = db.formVersions.findFirst(
    (item) => item.formId === row.formId && item.version === row.formVersion
  )
  if (version) return migrateFormContent(version.content)
  const form = db.forms.findById(row.formId)
  return form ? migrateFormContent(form.draft) : undefined
}

/** Lists read many submissions of few form versions: migrate each once. */
export function createContentCache() {
  const cache = new Map<string, FormContent | undefined>()
  return (row: SubmissionRow) => {
    const key = `${row.formId}@${row.formVersion}`
    if (!cache.has(key)) cache.set(key, submissionContent(row))
    return cache.get(key)
  }
}

const asText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null

/**
 * "Ayşe Demir · ayse@firma.com": the answers mapped to the record's name
 * and e-mail (or the form's e-mail field), else the usual answer keys.
 */
function contactLabel(row: SubmissionRow, content: FormContent | undefined) {
  const { answers } = row
  const byTarget = (target: string) => {
    const fieldId = Object.entries(content?.mapping.fields ?? {}).find(
      ([, key]) => key === target
    )?.[0]
    const field = content?.fields.find((item) => item.id === fieldId)
    return field ? asText(answers[field.key]) : null
  }
  const emailField = content?.fields.find((field) => field.type === "email")
  const name =
    byTarget("name") ?? asText(answers.name) ?? asText(answers.fullName)
  const email =
    byTarget("email") ??
    (emailField ? asText(answers[emailField.key]) : null) ??
    asText(answers.email)
  const parts = [name, email].filter(Boolean)
  return parts.length ? parts.join(" · ") : byTarget("companyName")
}

function recordRef(row: SubmissionRow) {
  if (!row.record) return null
  const ref = getRecordRef(row.workspaceId, row.record.objectKey, row.record.id)
  return ref
    ? { objectKey: row.record.objectKey, id: ref.id, title: ref.label }
    : null
}

export function toSubmissionSummary(
  row: SubmissionRow,
  content: FormContent | undefined = submissionContent(row)
): SubmissionSummary {
  return {
    id: row.id,
    formId: row.formId,
    formName: db.forms.findById(row.formId)?.name ?? "—",
    formVersion: row.formVersion,
    status: row.status,
    contactLabel: contactLabel(row, content),
    utm: row.utm,
    record: recordRef(row),
    createdAt: row.createdAt,
  }
}

export function toSubmission(
  row: SubmissionRow,
  language: Language
): Submission {
  const content = submissionContent(row)
  const answers = content
    ? getAnswerFields(content).map((field) => {
        const value = row.answers[field.key]
        const def = toEngineFieldDef(field)
        return {
          key: field.key,
          label: resolveI18nText(field.label, language) || field.key,
          value:
            value === undefined || value === null
              ? ""
              : formatFieldValue(def, value, { language }),
        }
      })
    : []
  return {
    ...toSubmissionSummary(row, content),
    answers,
    referrer: row.referrer,
    pageUrl: row.pageUrl,
    embedded: row.embedded,
    language: row.language,
    error: row.error,
  }
}
