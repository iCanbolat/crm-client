import { createFileRoute } from "@tanstack/react-router"

import { requirePermission } from "@/features/auth"
import { siteQueries, SiteSettingsPage } from "@/features/sites"

export const Route = createFileRoute("/_app/site")({
  staticData: { crumb: "site" },
  beforeLoad: ({ context }) => requirePermission(context.auth, "read", "site"),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(siteQueries.current()),
  component: SiteSettingsPage,
})
