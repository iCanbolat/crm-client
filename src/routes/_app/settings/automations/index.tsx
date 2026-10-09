import { createFileRoute } from "@tanstack/react-router"

import { automationQueries, AutomationsPage } from "@/features/automation"

export const Route = createFileRoute("/_app/settings/automations/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(automationQueries.list()),
  component: AutomationsPage,
})
