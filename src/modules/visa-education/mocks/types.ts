import type { I18nText } from "@/lib/i18n-text"

import type { ChecklistStatus, DocumentType } from "../lib/constants"
import type { Money } from "../lib/commission"
import type { Installment } from "../lib/payments"

export interface ChecklistItemRow {
  id: string
  workspaceId: string
  objectKey: string
  recordId: string
  key: string
  label: I18nText | string
  category: DocumentType
  required: boolean
  status: ChecklistStatus
  attachmentId: string | null
  expiresAt: string | null
  documentDate: string | null
  maxAgeDays: number | null
  note: string | null
  requestedAt: string | null
  updatedAt: string
  updatedBy: string | null
  sort: number
  custom: boolean
}

export interface PaymentPlanRow {
  /** `${objectKey}:${recordId}` */
  id: string
  workspaceId: string
  objectKey: string
  recordId: string
  serviceFee: Money
  installments: Installment[]
  updatedAt: string
}
