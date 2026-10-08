import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import { requirePermission } from "@/features/auth"
import { formQueries } from "@/features/form-builder"
import {
  SUBMISSION_LIST_DEFAULTS,
  submissionListSearchSchema,
  submissionQueries,
  SubmissionsPage,
} from "@/features/submissions"

const searchSchema = submissionListSearchSchema.omit({ formId: true })

export const Route = createFileRoute("/_app/forms/$formId/submissions")({
  staticData: { crumb: "submissions" },
  validateSearch: searchSchema,
  search: { middlewares: [stripSearchParams(SUBMISSION_LIST_DEFAULTS)] },
  loaderDeps: ({ search }) => search,
  beforeLoad: ({ context }) =>
    requirePermission(context.auth, "read", "submission"),
  loader: ({ context, deps, params }) =>
    context.queryClient.ensureQueryData(
      submissionQueries.list({ ...deps, formId: params.formId })
    ),
  component: FormSubmissionsRoute,
})

function FormSubmissionsRoute() {
  const { formId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: form } = useSuspenseQuery(formQueries.detail(formId))
  return (
    <SubmissionsPage
      form={{ id: form.id, name: form.name }}
      search={search}
      onSearchChange={({ formId: _formId, ...patch }) =>
        void navigate({ search: (prev) => ({ ...prev, ...patch }) })
      }
    />
  )
}
