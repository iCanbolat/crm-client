import { createFileRoute } from "@tanstack/react-router"

import { requirePermission } from "@/features/auth"
import { AutomationEditorPage } from "@/features/automation"

export const Route = createFileRoute("/_app/settings/automations/new")({
  staticData: { crumb: "automation" },
  beforeLoad: ({ context }) =>
    requirePermission(context.auth, "manage", "automation"),
  component: () => <AutomationEditorPage />,
})
