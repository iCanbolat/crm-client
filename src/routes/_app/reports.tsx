import { createFileRoute, Outlet } from "@tanstack/react-router"

import { requirePermission } from "@/features/auth"

/** Ready-made reports (B7.1). */
export const Route = createFileRoute("/_app/reports")({
  staticData: { crumb: "reports" },
  beforeLoad: ({ context }) =>
    requirePermission(context.auth, "read", "report"),
  component: Outlet,
})
