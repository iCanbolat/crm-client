import { createFileRoute, useNavigate } from "@tanstack/react-router"

import {
  AuthLayout,
  requireUnverified,
  useSignOut,
  VerifyEmailForm,
} from "@/features/auth"

/** Self sign-ups confirm their e-mail before the onboarding (Faz 10). */
export const Route = createFileRoute("/verify-email")({
  beforeLoad: async ({ context }) => ({
    me: await requireUnverified(context.queryClient),
  }),
  component: VerifyEmailPage,
})

function VerifyEmailPage() {
  const { me } = Route.useRouteContext()
  const navigate = useNavigate()
  const { signOut } = useSignOut()

  return (
    <AuthLayout>
      <VerifyEmailForm
        email={me.user.email}
        onVerified={() => navigate({ to: "/onboarding" })}
        onSignOut={signOut}
      />
    </AuthLayout>
  )
}
