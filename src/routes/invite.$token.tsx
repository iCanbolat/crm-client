import { createFileRoute } from "@tanstack/react-router"

import { AuthLayout, ensureSession } from "@/features/auth"
import {
  InvitationInvalid,
  InvitationPage,
  workspaceQueries,
} from "@/features/workspace"

/** Invitation link: signed in or not (Faz 10). */
export const Route = createFileRoute("/invite/$token")({
  beforeLoad: async ({ context }) => ({
    me: await ensureSession(context.queryClient),
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      workspaceQueries.invitation(params.token)
    ),
  errorComponent: () => (
    <AuthLayout>
      <InvitationInvalid />
    </AuthLayout>
  ),
  component: InvitationRoute,
})

function InvitationRoute() {
  const { token } = Route.useParams()
  const { me } = Route.useRouteContext()
  return (
    <AuthLayout>
      <InvitationPage token={token} me={me} />
    </AuthLayout>
  )
}
