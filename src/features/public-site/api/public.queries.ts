import { queryOptions } from "@tanstack/react-query"

import { fetchPublicForm, fetchPublicSite } from "./public.api"

export const publicKeys = {
  site: (host: string) => ["public", "site", host] as const,
  form: (slug: string) => ["public", "form", slug] as const,
}

export const publicQueries = {
  site: (host: string) =>
    queryOptions({
      queryKey: publicKeys.site(host),
      queryFn: ({ signal }) => fetchPublicSite(host, signal),
    }),
  form: (slug: string) =>
    queryOptions({
      queryKey: publicKeys.form(slug),
      queryFn: ({ signal }) => fetchPublicForm(slug, signal),
    }),
}
