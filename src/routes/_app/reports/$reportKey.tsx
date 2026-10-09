import {
  createFileRoute,
  notFound,
  stripSearchParams,
} from "@tanstack/react-router"

import {
  findReport,
  REPORT_SEARCH_DEFAULTS,
  reportQueries,
  ReportPage,
  reportSearchSchema,
  toReportParams,
} from "@/features/reports"
import { useWorkspace, workspaceQueries } from "@/features/workspace"

export const Route = createFileRoute("/_app/reports/$reportKey")({
  staticData: { crumb: "report" },
  validateSearch: reportSearchSchema,
  search: { middlewares: [stripSearchParams(REPORT_SEARCH_DEFAULTS)] },
  loaderDeps: ({ search }) => search,
  loader: async ({ context, params, deps }) => {
    const workspace = await context.queryClient.ensureQueryData(
      workspaceQueries.current()
    )
    // Unknown key or a report of a module the workspace does not use.
    if (!findReport(params.reportKey, workspace.modules)) throw notFound()
    await context.queryClient.ensureQueryData(
      reportQueries.detail(params.reportKey, toReportParams(deps))
    )
  },
  component: ReportRoute,
})

function ReportRoute() {
  const { reportKey } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const workspace = useWorkspace()
  const def = findReport(reportKey, workspace.modules)
  if (!def) return null
  return (
    <ReportPage
      key={reportKey}
      def={def}
      search={search}
      onSearchChange={(next) =>
        void navigate({
          search: (prev) => ({ ...prev, ...next }),
          replace: true,
        })
      }
    />
  )
}
