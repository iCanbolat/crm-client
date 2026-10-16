import { crmRecordSchema } from "@/engine/metadata"
import { apiClient } from "@/lib/api"

import {
  checklistResponseSchema,
  type ChecklistItemInput,
  type ChecklistItemPatch,
} from "./checklists.schemas"
import {
  paymentPlanResponseSchema,
  type PaymentInput,
  type PaymentPlanInput,
} from "./payments.schemas"

const segment = encodeURIComponent
const base = (prefix: string, objectKey: string, id: string) =>
  `/${prefix}/${segment(objectKey)}/${segment(id)}`

/* ------------------------------------------------------------- checklist */

export function fetchChecklist(
  objectKey: string,
  id: string,
  signal?: AbortSignal
) {
  return apiClient.get(base("checklists", objectKey, id), {
    signal,
    schema: checklistResponseSchema,
  })
}

export function applyChecklistTemplate(
  objectKey: string,
  id: string,
  templateKey: string
) {
  return apiClient.post(`${base("checklists", objectKey, id)}/apply-template`, {
    body: { templateKey },
    schema: checklistResponseSchema,
  })
}

export function addChecklistItem(
  objectKey: string,
  id: string,
  input: ChecklistItemInput
) {
  return apiClient.post(`${base("checklists", objectKey, id)}/items`, {
    body: input,
    schema: checklistResponseSchema,
  })
}

export function updateChecklistItem(
  objectKey: string,
  id: string,
  itemId: string,
  patch: ChecklistItemPatch
) {
  return apiClient.patch(
    `${base("checklists", objectKey, id)}/items/${segment(itemId)}`,
    { body: patch, schema: checklistResponseSchema }
  )
}

export function deleteChecklistItem(
  objectKey: string,
  id: string,
  itemId: string
) {
  return apiClient.delete(
    `${base("checklists", objectKey, id)}/items/${segment(itemId)}`,
    { schema: checklistResponseSchema }
  )
}

export function requestMissingDocuments(objectKey: string, id: string) {
  return apiClient.post(`${base("checklists", objectKey, id)}/request`, {
    schema: checklistResponseSchema,
  })
}

/* --------------------------------------------------------- payment plan */

export function fetchPaymentPlan(
  objectKey: string,
  id: string,
  signal?: AbortSignal
) {
  return apiClient.get(base("payment-plans", objectKey, id), {
    signal,
    schema: paymentPlanResponseSchema,
  })
}

export function savePaymentPlan(
  objectKey: string,
  id: string,
  input: PaymentPlanInput
) {
  return apiClient.put(base("payment-plans", objectKey, id), {
    body: input,
    schema: paymentPlanResponseSchema,
  })
}

export function recordPayment(
  objectKey: string,
  id: string,
  installmentId: string,
  input: PaymentInput
) {
  return apiClient.post(
    `${base("payment-plans", objectKey, id)}/installments/${segment(installmentId)}/pay`,
    { body: input, schema: paymentPlanResponseSchema }
  )
}

/* ------------------------------------------------------------ enrolment */

export function startVisaApplication(enrollmentId: string) {
  return apiClient.post(
    `/enrollments/${segment(enrollmentId)}/visa-application`,
    { schema: crmRecordSchema }
  )
}
