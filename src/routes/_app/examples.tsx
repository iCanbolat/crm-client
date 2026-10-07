import { createFileRoute, stripSearchParams } from "@tanstack/react-router"
import { useCallback } from "react"
import { useTranslation } from "react-i18next"

import { PageHeader } from "@/components/common/page-header"
import {
  EXAMPLE_LIST_DEFAULTS,
  exampleListSearchSchema,
  exampleQueries,
  ExamplesCard,
} from "@/features/_example"

export const Route = createFileRoute("/_app/examples")({
  staticData: { crumb: "examples" },
  validateSearch: exampleListSearchSchema,
  search: { middlewares: [stripSearchParams(EXAMPLE_LIST_DEFAULTS)] },
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(exampleQueries.list(deps)),
  component: ExamplesPage,
})

function ExamplesPage() {
  const { t } = useTranslation("example")
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const handlePageChange = useCallback(
    (page: number) => void navigate({ search: (prev) => ({ ...prev, page }) }),
    [navigate]
  )

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <ExamplesCard params={search} onPageChange={handlePageChange} />
    </div>
  )
}
