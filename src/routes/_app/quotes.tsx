import { createFileRoute, Outlet } from "@tanstack/react-router"

import { ensureModuleActive } from "@/features/workspace"

/** Forwarding module screens: 404 unless the workspace uses the module. */
export const Route = createFileRoute("/_app/quotes")({
  staticData: { crumb: "quotes" },
  beforeLoad: ({ context }) =>
    ensureModuleActive(context.queryClient, "forwarding"),
  component: Outlet,
})
