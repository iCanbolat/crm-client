import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, notFound } from "@tanstack/react-router"

import { automationQueries, AutomationEditorPage } from "@/features/automation"
import { isApiError } from "@/lib/api"

export const Route = createFileRoute("/_app/settings/automations/$ruleId")({
  staticData: { crumb: "automation" },
  loader: async ({ context, params }) => {
    try {
      await context.queryClient.ensureQueryData(
        automationQueries.detail(params.ruleId)
      )
    } catch (error) {
      if (isApiError(error) && error.status === 404) throw notFound()
      throw error
    }
  },
  component: AutomationRoute,
})

function AutomationRoute() {
  const { ruleId } = Route.useParams()
  const { data } = useSuspenseQuery(automationQueries.detail(ruleId))
  return <AutomationEditorPage key={data.id} rule={data} />
}
