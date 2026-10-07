import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { useWorkspace } from "@/features/workspace"
import {
  QuotePrintView,
  quoteQueries,
  referenceQueries,
} from "@/modules/forwarding"

export const Route = createFileRoute("/_app/quotes/$quoteId/print")({
  staticData: { crumb: "print" },
  loaderDeps: ({ search }) => ({ version: search.version }),
  loader: ({ context, params, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(
        quoteQueries.detail(params.quoteId, deps.version)
      ),
      context.queryClient.ensureQueryData(referenceQueries.fxRates()),
    ]).then(() => null),
  component: QuotePrintRoute,
})

function QuotePrintRoute() {
  const { quoteId } = Route.useParams()
  const { version } = Route.useSearch()
  const workspace = useWorkspace()
  const { data: quote } = useSuspenseQuery(
    quoteQueries.detail(quoteId, version)
  )
  return <QuotePrintView quote={quote} workspaceName={workspace.name} />
}
