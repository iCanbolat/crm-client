import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { recordKeys } from "@/features/records"

import type {
  ChecklistItemInput,
  ChecklistItemPatch,
} from "./checklists.schemas"
import type { PaymentInput, PaymentPlanInput } from "./payments.schemas"
import {
  addChecklistItem,
  applyChecklistTemplate,
  deleteChecklistItem,
  fetchChecklist,
  fetchPaymentPlan,
  recordPayment,
  requestMissingDocuments,
  savePaymentPlan,
  startVisaApplication,
  updateChecklistItem,
} from "./visa-education.api"

export const visaEducationKeys = {
  all: ["visa-education"] as const,
  checklist: (objectKey: string, id: string) =>
    [...visaEducationKeys.all, "checklist", objectKey, id] as const,
  paymentPlan: (objectKey: string, id: string) =>
    [...visaEducationKeys.all, "payment-plan", objectKey, id] as const,
}

export const visaEducationQueries = {
  checklist: (objectKey: string, id: string) =>
    queryOptions({
      queryKey: visaEducationKeys.checklist(objectKey, id),
      queryFn: ({ signal }) => fetchChecklist(objectKey, id, signal),
    }),
  paymentPlan: (objectKey: string, id: string) =>
    queryOptions({
      queryKey: visaEducationKeys.paymentPlan(objectKey, id),
      queryFn: ({ signal }) => fetchPaymentPlan(objectKey, id, signal),
    }),
}

/** Summary fields (progress, missing count, payment status) live on the record. */
function useRecordSync(objectKey: string) {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: recordKeys.object(objectKey) })
}

export function useChecklistMutations(objectKey: string, id: string) {
  const { t } = useTranslation("visaEducation")
  const queryClient = useQueryClient()
  const syncRecord = useRecordSync(objectKey)
  const onSuccess = (data: Awaited<ReturnType<typeof fetchChecklist>>) => {
    queryClient.setQueryData(visaEducationKeys.checklist(objectKey, id), data)
    return syncRecord()
  }
  return {
    update: useMutation({
      mutationFn: ({
        itemId,
        patch,
      }: {
        itemId: string
        patch: ChecklistItemPatch
      }) => updateChecklistItem(objectKey, id, itemId, patch),
      onSuccess,
    }),
    add: useMutation({
      mutationFn: (input: ChecklistItemInput) =>
        addChecklistItem(objectKey, id, input),
      meta: { successMessage: t("checklist.added") },
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (itemId: string) =>
        deleteChecklistItem(objectKey, id, itemId),
      onSuccess,
    }),
    applyTemplate: useMutation({
      mutationFn: (templateKey: string) =>
        applyChecklistTemplate(objectKey, id, templateKey),
      meta: { successMessage: t("checklist.templateApplied") },
      onSuccess,
    }),
    request: useMutation({
      mutationFn: () => requestMissingDocuments(objectKey, id),
      meta: { successMessage: t("checklist.requested") },
      onSuccess,
    }),
  }
}

export function usePaymentMutations(objectKey: string, id: string) {
  const { t } = useTranslation("visaEducation")
  const queryClient = useQueryClient()
  const syncRecord = useRecordSync(objectKey)
  const onSuccess = (data: Awaited<ReturnType<typeof fetchPaymentPlan>>) => {
    queryClient.setQueryData(visaEducationKeys.paymentPlan(objectKey, id), data)
    return syncRecord()
  }
  return {
    save: useMutation({
      mutationFn: (input: PaymentPlanInput) =>
        savePaymentPlan(objectKey, id, input),
      meta: { successMessage: t("payments.saved") },
      onSuccess,
    }),
    pay: useMutation({
      mutationFn: ({
        installmentId,
        input,
      }: {
        installmentId: string
        input: PaymentInput
      }) => recordPayment(objectKey, id, installmentId, input),
      meta: { successMessage: t("payments.recorded") },
      onSuccess,
    }),
  }
}

export function useStartVisaApplication(enrollmentId: string) {
  const { t } = useTranslation("visaEducation")
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => startVisaApplication(enrollmentId),
    meta: { successMessage: t("enrollment.visaStarted") },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: recordKeys.all }),
  })
}
