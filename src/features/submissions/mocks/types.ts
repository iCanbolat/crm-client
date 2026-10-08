import type { FormAnswers } from "@/engine/forms"

import type { SubmissionStatus, Utm } from "../api/submissions.schemas"

/** Stored submission (B5.5): raw answers as validated at submit time. */
export interface SubmissionRow {
  id: string
  workspaceId: string
  formId: string
  formVersion: number
  answers: FormAnswers
  status: SubmissionStatus
  /** Created lead or the existing contact it was linked to. */
  record: { objectKey: string; id: string } | null
  utm: Utm
  referrer: string | null
  pageUrl: string | null
  embedded: boolean
  language: string
  error: { code: string; message: string } | null
  createdAt: string
}
