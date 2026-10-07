import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { recordKeys } from "@/features/records"

import { fetchMilestones, recordMilestone } from "./shipments.api"
import type { MilestoneInput } from "./shipments.schemas"

export const shipmentKeys = {
  all: ["forwarding", "shipments"] as const,
  milestones: (id: string) => [...shipmentKeys.all, "milestones", id] as const,
}

export const shipmentQueries = {
  milestones: (id: string) =>
    queryOptions({
      queryKey: shipmentKeys.milestones(id),
      queryFn: ({ signal }) => fetchMilestones(id, signal),
    }),
}

export function useRecordMilestone(shipmentId: string) {
  const { t } = useTranslation("forwarding")
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: MilestoneInput) => recordMilestone(shipmentId, input),
    meta: { successMessage: t("shipment.recorded") },
    onSuccess: (list) => {
      queryClient.setQueryData(shipmentKeys.milestones(shipmentId), list)
      // Status, ATD/ATA and the delay flag live on the shipment record.
      return queryClient.invalidateQueries({
        queryKey: recordKeys.object("shipment"),
      })
    },
  })
}
