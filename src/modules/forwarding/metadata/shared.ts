import type { DetailSection, FieldDef } from "@/engine/metadata"
import { CURRENCIES } from "@/lib/currencies"

import { option, t } from "../lib/constants"

export const newestFirst = { field: "createdAt", direction: "desc" } as const

/** Owner, tags and timestamps (same contract as the core objects). */
export function systemFields(): FieldDef[] {
  return [
    {
      key: "ownerId",
      label: t("Sahip", "Owner"),
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
        option("project", t("Proje kargo", "Project cargo"), "amber"),
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

export const CURRENCY_OPTIONS = CURRENCIES.map((code) =>
  option(code, t(code, code))
)

export const relation = (objectKey: string, displayField = "name") => ({
  objectKey,
  displayField,
})
