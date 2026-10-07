import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import {
  FORM_LIST_DEFAULTS,
  formListSearchSchema,
  formQueries,
  FormsListPage,
} from "@/features/form-builder"

export const Route = createFileRoute("/_app/forms/")({
  validateSearch: formListSearchSchema,
  search: { middlewares: [stripSearchParams(FORM_LIST_DEFAULTS)] },
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(formQueries.list(deps)),
  component: FormsRoute,
})

function FormsRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <FormsListPage
      search={search}
      onSearchChange={(patch) =>
        void navigate({ search: (prev) => ({ ...prev, ...patch }) })
      }
    />
  )
}
