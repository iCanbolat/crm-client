import { toCsv } from "@/lib/csv"

import type { SubmissionSummary } from "../api/submissions.schemas"

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
