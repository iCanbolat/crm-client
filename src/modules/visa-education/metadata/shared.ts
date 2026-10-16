import type { DetailSection, FieldDef, ObjectDef } from "@/engine/metadata"

import { option, PAYMENT_STATUS_OPTIONS, t } from "../lib/constants"

export const newestFirst = { field: "createdAt", direction: "desc" } as const

/** Owner, tags and timestamps (same contract as the core objects). */
export function systemFields(): FieldDef[] {
  return [
    {
      key: "ownerId",
      label: t("Danışman", "Counsellor"),
      type: "user",
      required: true,
      system: true,
    },
    {
      key: "tags",
      label: t("Etiketler", "Tags"),
      type: "multiselect",
      system: true,
      options: [
        option("vip", t("VIP", "VIP"), "violet"),
        option("urgent", t("Acil", "Urgent"), "red"),
        option("scholarship", t("Burslu", "Scholarship"), "green"),
      ],
    },
    {
      key: "createdAt",
      label: t("Oluşturulma", "Created"),
      type: "datetime",
      system: true,
      readOnly: true,
    },
    {
      key: "updatedAt",
      label: t("Son güncelleme", "Last updated"),
      type: "datetime",
      system: true,
      readOnly: true,
    },
  ]
}

export const SYSTEM_SECTION: DetailSection = {
  key: "system",
  label: t("Sahiplik ve kayıt bilgisi", "Ownership & record info"),
  fields: ["ownerId", "tags", "createdAt", "updatedAt"],
}

export const relation = (objectKey: string, displayField = "name") => ({
  objectKey,
  displayField,
})

/** Read-only summary fields kept in sync by the checklist / payment APIs. */
export function trackingFields(): FieldDef[] {
  return [
    {
      key: "checklistProgress",
      label: t("Belge ilerlemesi", "Document progress"),
      type: "percent",
      system: true,
      readOnly: true,
    },
    {
      key: "missingDocuments",
      label: t("Eksik belge", "Missing documents"),
      type: "number",
      system: true,
      readOnly: true,
    },
    {
      key: "serviceFee",
      label: t("Hizmet bedeli", "Service fee"),
      type: "currency",
      system: true,
      readOnly: true,
    },
    {
      key: "paidAmount",
      label: t("Tahsil edilen", "Collected"),
      type: "currency",
      system: true,
      readOnly: true,
    },
    {
      key: "outstandingAmount",
      label: t("Kalan ödeme", "Outstanding"),
      type: "currency",
      system: true,
      readOnly: true,
    },
    {
      key: "paymentStatus",
      label: t("Ödeme durumu", "Payment status"),
      type: "select",
      system: true,
      readOnly: true,
      options: PAYMENT_STATUS_OPTIONS,
    },
    {
      key: "nextDueDate",
      label: t("Sonraki vade", "Next due date"),
      type: "date",
      system: true,
      readOnly: true,
    },
  ]
}

export const TRACKING_SECTION: DetailSection = {
  key: "tracking",
  label: t("Belgeler ve ödemeler", "Documents & payments"),
  fields: [
    "checklistProgress",
    "missingDocuments",
    "serviceFee",
    "paidAmount",
    "outstandingAmount",
    "paymentStatus",
    "nextDueDate",
  ],
}

/** The stage select of a module object offers exactly its pipeline stages. */
export function withStageOptions(def: ObjectDef): ObjectDef {
  const pipeline = def.pipeline
  if (!pipeline) return def
  return {
    ...def,
    fields: def.fields.map((field) =>
      field.key === pipeline.field
        ? {
            ...field,
            options: pipeline.stages.map((stage) => ({
              value: stage.key,
              label: stage.label,
              ...(stage.color ? { color: stage.color } : {}),
            })),
          }
        : field
    ),
  }
}
