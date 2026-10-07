import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import {
  draftToInput,
  QuoteBuilder,
  quoteQueries,
  referenceQueries,
} from "@/modules/forwarding"

const searchSchema = z.object({
  leadId: z.string().optional().catch(undefined),
  dealId: z.string().optional().catch(undefined),
  companyId: z.string().optional().catch(undefined),
})

/** New quote, prefilled from a freight request and/or a deal. */
export const Route = createFileRoute("/_app/quotes/new")({
  staticData: { crumb: "new" },
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(quoteQueries.draft(deps)),
      context.queryClient.ensureQueryData(referenceQueries.fxRates()),
    ]).then(() => null),
  component: NewQuoteRoute,
})

function NewQuoteRoute() {
  const search = Route.useSearch()
  const { data: draft } = useSuspenseQuery(quoteQueries.draft(search))
  return (
    <QuoteBuilder
      key={`${search.leadId ?? ""}:${search.dealId ?? ""}:${search.companyId ?? ""}`}
      initial={draftToInput(draft)}
      refs={draft.refs}
    />
  )
}
