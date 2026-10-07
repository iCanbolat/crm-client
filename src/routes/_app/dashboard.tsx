import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import {
  DASHBOARD_SEARCH_DEFAULTS,
  DashboardPage,
  dashboardSearchSchema,
} from "@/features/dashboard"

export const Route = createFileRoute("/_app/dashboard")({
  staticData: { crumb: "dashboard" },
  validateSearch: dashboardSearchSchema,
  search: { middlewares: [stripSearchParams(DASHBOARD_SEARCH_DEFAULTS)] },
  component: DashboardRoute,
})

function DashboardRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <DashboardPage
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
