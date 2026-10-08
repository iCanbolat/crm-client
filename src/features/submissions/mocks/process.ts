import { applyMapping, type FormAnswers } from "@/engine/forms"
import type { FormRow } from "@/features/form-builder/mocks/types"
import { createRecord, getObjectDef } from "@/features/records/mocks/store"
import { isLanguage } from "@/lib/i18n"
import { db } from "@/mocks/db"
import type { getRequestT } from "@/mocks/utils/http"

import { UTM_KEYS, type Utm } from "../api/submissions.schemas"
import { submissionContent, toSubmission } from "./store"
import type { SubmissionRow } from "./types"

type RequestT = ReturnType<typeof getRequestT>

const UTM_ANSWER_KEYS: Record<keyof Utm, string> = {
  source: "utmSource",
  medium: "utmMedium",
  campaign: "utmCampaign",
  term: "utmTerm",
  content: "utmContent",
}

/**
 * UTM parameters of the page the form was submitted from, falling back to
 * the form's hidden UTM fields (an embed sees its own iframe URL).
 */
export function extractUtm(pageUrl: string | null, answers: FormAnswers): Utm {
  let params = new URLSearchParams()
  try {
    if (pageUrl) params = new URL(pageUrl).searchParams
  } catch {
    // Not a URL: hidden fields only.
  }
  return Object.fromEntries(
    UTM_KEYS.map((key) => {
      const answer = answers[UTM_ANSWER_KEYS[key]]
      const value =
        params.get(`utm_${key}`) || (typeof answer === "string" ? answer : "")
      return [key, value.trim().slice(0, 200) || null]
    })
  ) as Utm
}

/** Records the submission on a lead / contact timeline. */
function logActivity(
  row: SubmissionRow,
  record: { objectKey: string; id: string },
  ownerId: string
) {
  const language = isLanguage(row.language) ? row.language : "tr"
  const submission = toSubmission(row, language)
  const now = new Date().toISOString()
  db.activities.create({
    id: `act_${crypto.randomUUID().slice(0, 12)}`,
    workspaceId: row.workspaceId,
    type: "note",
    subject: `${language === "en" ? "Form submission" : "Form gönderimi"}: ${submission.formName}`,
    body: submission.answers
      .filter((answer) => answer.value)
      .map((answer) => `${answer.label}: ${answer.value}`)
      .join("\n"),
    occurredAt: row.createdAt,
    durationMinutes: null,
    direction: "inbound",
    objectKey: record.objectKey,
    recordId: record.id,
    createdBy: ownerId,
    createdAt: now,
  })
}

/** Owner of created records: the mapping's, else the form's creator. */
function resolveOwner(form: FormRow, ownerId: string | null) {
  const isMember = (userId: string | null) =>
    !!userId &&
    !!db.memberships.findFirst(
      (item) => item.workspaceId === form.workspaceId && item.userId === userId
    )
  return isMember(ownerId) ? ownerId! : form.ownerId
}

/**
 * Applies the form's CRM mapping (B5.5): links an existing contact by
 * e-mail when the form asks for it, otherwise creates the target record
 * (`source: webForm`, default owner, first stage). A record that fails
 * validation leaves the submission `failed` for manual conversion.
 */
export function convertSubmission(
  row: SubmissionRow,
  t: RequestT
): SubmissionRow {
  const form = db.forms.findById(row.formId)
  const content = submissionContent(row)
  const def = content
    ? getObjectDef(row.workspaceId, content.mapping.objectKey)
    : undefined
  const fail = (code: string, message: string) =>
    db.submissions.update(row.id, {
      status: "failed",
      record: null,
      error: { code, message },
    })!
  if (!form || !content || !def) {
    return fail("TARGET_MISSING", t("mock.notFound"))
  }

  const { mapping } = content
  const ownerId = resolveOwner(form, mapping.ownerId)
  const mapped = applyMapping(
    content,
    def,
    row.answers,
    isLanguage(row.language) ? row.language : undefined
  )

  if (mapping.duplicate === "linkContactByEmail") {
    const email =
      typeof mapped.values.email === "string"
        ? mapped.values.email.toLowerCase()
        : null
    const contact = email
      ? db.records.findFirst(
          (record) =>
            record.workspaceId === row.workspaceId &&
            record.objectKey === "contact" &&
            String(record.values.email ?? "").toLowerCase() === email
        )
      : undefined
    if (contact) {
      const record = { objectKey: "contact", id: contact.id }
      const updated = db.submissions.update(row.id, { record, error: null })!
      logActivity(updated, record, ownerId)
      return updated
    }
  }

  const sourceField = def.fields.find((field) => field.key === "source")
  const values = {
    ...(sourceField?.options?.some((option) => option.value === "webForm")
      ? { source: "webForm" }
      : {}),
    ...mapped.values,
  }
  const created = createRecord(row.workspaceId, def, values, { ownerId, t })
  if (!created.ok) {
    const details = Object.entries(created.fieldErrors)
      .map(([key, messages]) => `${key}: ${messages[0]}`)
      .join("; ")
    return fail(created.code, details)
  }

  const record = { objectKey: def.key, id: created.row.id }
  const updated = db.submissions.update(row.id, {
    record,
    error: null,
    status: row.status === "failed" ? "new" : row.status,
  })!
  logActivity(updated, record, ownerId)
  return updated
}
