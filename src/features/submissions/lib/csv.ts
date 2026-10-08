import type { SubmissionSummary } from "../api/submissions.schemas"

/** RFC 4180 field: quoted when it holds a delimiter, quote or newline. */
function escapeCsv(value: string) {
  // Leading = + - @ would run as a formula in spreadsheets.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return /[",;\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(rows: readonly (readonly string[])[]) {
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n")
}

export const SUBMISSION_CSV_COLUMNS = [
  "createdAt",
  "form",
  "status",
  "contact",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "record",
  "recordId",
] as const
export type SubmissionCsvColumn = (typeof SUBMISSION_CSV_COLUMNS)[number]

/** Inbox export (TC-5.6-03): one row per submission, ISO dates. */
export function submissionsToCsv(
  submissions: readonly SubmissionSummary[],
  headers: Record<SubmissionCsvColumn, string>,
  statusLabel: (status: SubmissionSummary["status"]) => string
) {
  return toCsv([
    SUBMISSION_CSV_COLUMNS.map((column) => headers[column]),
    ...submissions.map((item) => [
      item.createdAt,
      item.formName,
      statusLabel(item.status),
      item.contactLabel ?? "",
      item.utm.source ?? "",
      item.utm.medium ?? "",
      item.utm.campaign ?? "",
      item.record?.title ?? "",
      item.record?.id ?? "",
    ]),
  ])
}

/** Saves text as a file (UTF-8 BOM so Excel reads Turkish characters). */
export function downloadText(
  filename: string,
  content: string,
  type = "text/csv"
) {
  const blob = new Blob(["﻿", content], { type: `${type};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
