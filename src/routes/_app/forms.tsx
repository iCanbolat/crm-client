import { createFileRoute, Outlet } from "@tanstack/react-router"

import { requirePermission } from "@/features/auth"

/** Form builder screens (Faz 4). */
export const Route = createFileRoute("/_app/forms")({
  staticData: { crumb: "forms" },
  beforeLoad: ({ context }) => requirePermission(context.auth, "read", "form"),
  component: Outlet,
})
