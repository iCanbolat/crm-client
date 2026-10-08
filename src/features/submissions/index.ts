/**
 * Form submissions inbox (Faz 5, B5.6): list with filters, raw answers,
 * status, manual conversion and CSV export. Submissions become CRM
 * records on the mock server (B5.5).
 */
export { submissionKeys } from "./api/submissions.keys"
export {
  useConvertSubmission,
  useUpdateSubmission,
} from "./api/submissions.mutations"
export { submissionQueries } from "./api/submissions.queries"
export {
  SUBMISSION_LIST_DEFAULTS,
  SUBMISSION_STATUSES,
  submissionListSearchSchema,
  submissionSchema,
  submissionSummarySchema,
} from "./api/submissions.schemas"
export type {
  Submission,
  SubmissionListParams,
  SubmissionStatus,
  SubmissionSummary,
} from "./api/submissions.schemas"
export { SubmissionsPage } from "./components/submissions-page"
