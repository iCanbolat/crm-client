import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import {
  AuthLayout,
  ensureSession,
  resolveActiveMembership,
} from "@/features/auth"
import { sanitizeRedirect } from "@/lib/redirect"

export const Route = createFileRoute("/_auth")({
  beforeLoad: async ({ context, location }) => {
    const me = await ensureSession(context.queryClient)
    if (me && resolveActiveMembership(me)) {
      const target = sanitizeRedirect(
        (location.search as { redirect?: unknown }).redirect
      )
      throw redirect({ href: target ?? "/dashboard" })
    }
  },
  component: AuthRouteLayout,
})

function AuthRouteLayout() {
  return (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  )
}
