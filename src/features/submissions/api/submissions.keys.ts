import type { SubmissionListParams } from "./submissions.schemas"

export const submissionKeys = {
  all: ["submissions"] as const,
  lists: () => [...submissionKeys.all, "list"] as const,
  list: (params: SubmissionListParams) =>
    [...submissionKeys.lists(), params] as const,
  details: () => [...submissionKeys.all, "detail"] as const,
  detail: (id: string) => [...submissionKeys.details(), id] as const,
}
