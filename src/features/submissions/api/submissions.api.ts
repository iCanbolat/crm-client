import { apiClient, MAX_PAGE_SIZE } from "@/lib/api"

import {
  submissionListSchema,
  submissionSchema,
  type SubmissionListParams,
  type SubmissionSummary,
  type UpdateSubmissionInput,
} from "./submissions.schemas"

const segment = (id: string) => encodeURIComponent(id)

export function fetchSubmissions(
  params: SubmissionListParams,
  signal?: AbortSignal
) {
  return apiClient.get("/submissions", {
    signal,
    query: params,
    schema: submissionListSchema,
  })
}

/** Every page of a filtered list (CSV export, TC-5.6-03). */
export async function fetchAllSubmissions(
  params: Omit<SubmissionListParams, "page" | "pageSize">
) {
  const rows: SubmissionSummary[] = []
  for (let page = 1; ; page++) {
    const result = await fetchSubmissions({
      ...params,
      page,
      pageSize: MAX_PAGE_SIZE,
    })
    rows.push(...result.data)
    if (rows.length >= result.meta.total || result.data.length === 0) {
      return rows
    }
  }
}

export function fetchSubmission(id: string, signal?: AbortSignal) {
  return apiClient.get(`/submissions/${segment(id)}`, {
    signal,
    schema: submissionSchema,
  })
}

export function updateSubmission(id: string, input: UpdateSubmissionInput) {
  return apiClient.patch(`/submissions/${segment(id)}`, {
    body: input,
    schema: submissionSchema,
  })
}

export function convertSubmission(id: string) {
  return apiClient.post(`/submissions/${segment(id)}/convert`, {
    schema: submissionSchema,
  })
}
