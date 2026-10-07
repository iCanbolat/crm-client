import { useQuery } from "@tanstack/react-query"

import { getRecordTitle, label } from "@/engine/metadata"
import { getCurrentLanguage } from "@/lib/i18n"

import { recordQueries } from "../api/records.queries"
import { useOptionalObjectDef } from "../hooks/use-object-def"

/** Breadcrumb label of an object list ("Şirketler"); `null` if unknown. */
export function useObjectCrumb(objectKey: string | undefined) {
  const def = useOptionalObjectDef(objectKey)
  return def ? label(def.pluralLabel, getCurrentLanguage()) : null
}

/** Breadcrumb label of a record: its live title from the detail cache. */
export function useRecordCrumb(
  objectKey: string | undefined,
  recordId: string | undefined
) {
  const def = useOptionalObjectDef(objectKey)
  const { data } = useQuery({
    ...recordQueries.detail(objectKey ?? "", recordId ?? ""),
    enabled: !!def && !!recordId,
  })
  return def && data ? getRecordTitle(def, data) : null
}
