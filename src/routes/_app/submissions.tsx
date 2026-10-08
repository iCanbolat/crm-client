import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import { requirePermission } from "@/features/auth"
import {
  SUBMISSION_LIST_DEFAULTS,
  submissionListSearchSchema,
  submissionQueries,
  SubmissionsPage,
} from "@/features/submissions"

export const Route = createFileRoute("/_app/submissions")({
  staticData: { crumb: "submissions" },
  validateSearch: submissionListSearchSchema,
  search: { middlewares: [stripSearchParams(SUBMISSION_LIST_DEFAULTS)] },
  loaderDeps: ({ search }) => search,
  beforeLoad: ({ context }) =>
    requirePermission(context.auth, "read", "submission"),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(submissionQueries.list(deps)),
  component: SubmissionsRoute,
})

function SubmissionsRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <SubmissionsPage
      search={search}
      onSearchChange={(patch) =>
        void navigate({ search: (prev) => ({ ...prev, ...patch }) })
      }
    />
  )
}
