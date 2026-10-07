import { useTranslation } from "react-i18next"

import { getFieldType } from "@/engine/field-types"

import { isCoreFieldType } from "../lib/drafts"

export function useFieldTypeLabel() {
  const { t } = useTranslation("engine")
  return (type: string) =>
    isCoreFieldType(type) ? t(`fieldTypes.${type}`) : type
}

/** Icon + localized name of a field type. */
export function FieldTypeLabel({ type }: { type: string }) {
  const toLabel = useFieldTypeLabel()
  const Icon = getFieldType(type).icon
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <Icon className="size-3.5" aria-hidden />
      {toLabel(type)}
    </span>
  )
}
