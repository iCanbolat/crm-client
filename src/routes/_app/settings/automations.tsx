import { createFileRoute, Outlet } from "@tanstack/react-router"

import { requirePermission } from "@/features/auth"

/** Automation rules (B7.3). */
export const Route = createFileRoute("/_app/settings/automations")({
  staticData: { crumb: "automations" },
  beforeLoad: ({ context }) =>
    requirePermission(context.auth, "read", "automation"),
  component: Outlet,
})
