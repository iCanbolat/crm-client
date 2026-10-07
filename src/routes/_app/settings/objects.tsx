import { createFileRoute, Outlet } from "@tanstack/react-router"

import { requirePermission } from "@/features/auth"

export const Route = createFileRoute("/_app/settings/objects")({
  staticData: { crumb: "objects" },
  beforeLoad: ({ context }) =>
    requirePermission(context.auth, "manage", "workspace"),
  component: Outlet,
})
