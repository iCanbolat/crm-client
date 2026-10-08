import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { recordKeys } from "@/features/records"

import { convertSubmission, updateSubmission } from "./submissions.api"
import { submissionKeys } from "./submissions.keys"
import type { Submission, UpdateSubmissionInput } from "./submissions.schemas"

function useStoreSubmission() {
  const queryClient = useQueryClient()
  return (submission: Submission) => {
    queryClient.setQueryData(submissionKeys.detail(submission.id), submission)
    return queryClient.invalidateQueries({ queryKey: submissionKeys.lists() })
  }
}

export function useUpdateSubmission(id: string) {
  const { t } = useTranslation("submissions")
  const store = useStoreSubmission()

  return useMutation({
    mutationFn: (input: UpdateSubmissionInput) => updateSubmission(id, input),
    meta: { successMessage: t("toast.statusChanged") },
    onSuccess: store,
  })
}

export function useConvertSubmission(id: string) {
  const { t } = useTranslation("submissions")
  const store = useStoreSubmission()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => convertSubmission(id),
    meta: { successMessage: t("toast.converted") },
    onSuccess: async (submission) => {
      await store(submission)
      // A new lead appeared in the CRM lists.
      await queryClient.invalidateQueries({ queryKey: recordKeys.all })
    },
  })
}
