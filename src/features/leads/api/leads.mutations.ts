import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { recordKeys } from "@/features/records"

import { convertLead } from "./leads.api"
import type { ConvertLeadInput } from "./leads.schemas"

export function useConvertLead(leadId: string) {
  const { t } = useTranslation("leads")
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ConvertLeadInput) => convertLead(leadId, input),
    meta: { successMessage: t("convert.success") },
    onSuccess: (result) => {
      queryClient.setQueryData(recordKeys.detail("lead", leadId), result.lead)
      // New company/contact/deal and the lead's stage: every list and board.
      return queryClient.invalidateQueries({
        queryKey: recordKeys.all,
        predicate: (query) =>
          !(query.queryKey[2] === "detail" && query.queryKey[3] === leadId),
      })
    },
  })
}
