import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { fetchForm, fetchForms, fetchFormStats } from "./forms.api"
import { formKeys } from "./forms.keys"
import type { FormListParams } from "./forms.schemas"

export const formQueries = {
  list: (params: FormListParams) =>
    queryOptions({
      queryKey: formKeys.list(params),
      queryFn: ({ signal }) => fetchForms(params, signal),
      placeholderData: keepPreviousData,
    }),
  // Awaited by the editor loader and observed by the breadcrumb: no signal
  // (see records.queries).
  detail: (id: string) =>
    queryOptions({
      queryKey: formKeys.detail(id),
      queryFn: () => fetchForm(id),
    }),
  stats: (id: string) =>
    queryOptions({
      queryKey: formKeys.stats(id),
      queryFn: ({ signal }) => fetchFormStats(id, signal),
    }),
}
