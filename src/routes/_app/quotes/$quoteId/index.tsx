import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, notFound } from "@tanstack/react-router"

import { isApiError } from "@/lib/api"
import {
  QuoteBuilder,
  quoteQueries,
  quoteToInput,
  referenceQueries,
} from "@/modules/forwarding"

export const Route = createFileRoute("/_app/quotes/$quoteId/")({
  loaderDeps: ({ search }) => ({ version: search.version }),
  loader: async ({ context, params, deps }) => {
    try {
      await Promise.all([
        context.queryClient.ensureQueryData(
          quoteQueries.detail(params.quoteId, deps.version)
        ),
        context.queryClient.ensureQueryData(referenceQueries.fxRates()),
      ])
    } catch (error) {
      if (isApiError(error) && error.status === 404) throw notFound()
      throw error
    }
    return null
  },
  component: QuoteRoute,
})

function QuoteRoute() {
  const { quoteId } = Route.useParams()
  const { version } = Route.useSearch()
  const { data: quote } = useSuspenseQuery(
    quoteQueries.detail(quoteId, version)
  )
  return (
    <QuoteBuilder
      // A new version (or a saved revision) starts a fresh form.
      key={`${quote.id}:${quote.version}:${quote.status}`}
      initial={quoteToInput(quote)}
      quote={quote}
      refs={quote.refs}
    />
  )
}
