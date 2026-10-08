import {
  isAnswerField,
  migrateFormContent,
  type FormContent,
} from "@/engine/forms"
import { db } from "@/mocks/db"

import type { Form, FormSummary } from "../api/forms.schemas"
import type { FormRow } from "./types"

export function formsOf(workspaceId: string) {
  return db.forms.findMany((row) => row.workspaceId === workspaceId)
}

export function findFormRow(workspaceId: string, id: string) {
  const row = db.forms.findById(id)
  return row && row.workspaceId === workspaceId ? row : undefined
}

export function versionsOf(formId: string) {
  return db.formVersions
    .findMany((row) => row.formId === formId)
    .sort((a, b) => a.version - b.version)
}

/** Draft content in the current schema (older drafts are migrated). */
export function readDraft(row: FormRow): FormContent {
  return migrateFormContent(row.draft)
}

const sameContent = (a: FormContent, b: FormContent) =>
  JSON.stringify(a) === JSON.stringify(b)

/** The draft differs from the latest published version. */
export function hasUnpublishedChanges(row: FormRow) {
  const latest = versionsOf(row.id).at(-1)
  if (!latest) return false
  return !sameContent(readDraft(row), migrateFormContent(latest.content))
}

/** Submissions that count for the stats (spam excluded, B5.5). */
export function countSubmissions(formId: string) {
  return db.submissions.findMany(
    (submission) => submission.formId === formId && submission.status !== "spam"
  ).length
}

export function toFormSummary(row: FormRow): FormSummary {
  const content = readDraft(row)
  const submissions = countSubmissions(row.id)
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    publishedVersion: row.publishedVersion,
    hasUnpublishedChanges: hasUnpublishedChanges(row),
    fieldCount: content.fields.filter(isAnswerField).length,
    ownerId: row.ownerId,
    ownerName: db.users.findById(row.ownerId)?.name ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    stats: {
      views: row.views,
      submissions,
      conversionRate: row.views
        ? Math.round((submissions / row.views) * 10_000) / 10_000
        : 0,
    },
  }
}

export function toForm(row: FormRow): Form {
  return { ...toFormSummary(row), content: readDraft(row) }
}

export function isSlugTaken(
  workspaceId: string,
  slug: string,
  exceptId?: string
) {
  return formsOf(workspaceId).some(
    (row) => row.slug === slug && row.id !== exceptId
  )
}
