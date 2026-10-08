import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { fetchSubmission, fetchSubmissions } from "./submissions.api"
import { submissionKeys } from "./submissions.keys"
import type { SubmissionListParams } from "./submissions.schemas"

export const submissionQueries = {
  list: (params: SubmissionListParams) =>
    queryOptions({
      queryKey: submissionKeys.list(params),
      queryFn: ({ signal }) => fetchSubmissions(params, signal),
      placeholderData: keepPreviousData,
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: submissionKeys.detail(id),
      queryFn: ({ signal }) => fetchSubmission(id, signal),
    }),
}
