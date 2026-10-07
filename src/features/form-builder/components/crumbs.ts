import { useQuery } from "@tanstack/react-query"

import { formQueries } from "../api/forms.queries"

/** Breadcrumb label of a form: its live name from the detail cache. */
export function useFormCrumb(formId: string | undefined) {
  const { data } = useQuery({
    ...formQueries.detail(formId ?? ""),
    enabled: !!formId,
  })
  return data?.name ?? null
}
