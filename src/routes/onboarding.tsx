import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"

import { requireAuth, usePermission, useSignOut } from "@/features/auth"
import {
  isOnboardingComplete,
  OnboardingLayout,
  OnboardingPending,
  OnboardingWizard,
  workspaceQueries,
} from "@/features/workspace"

export const Route = createFileRoute("/onboarding")({
  beforeLoad: async ({ context, location }) => {
    const auth = await requireAuth(context.queryClient, location)
    const workspace = await context.queryClient.ensureQueryData(
      workspaceQueries.current()
    )
    if (isOnboardingComplete(workspace.onboarding)) {
      throw redirect({ to: "/dashboard" })
    }
    return { auth }
  },
  component: OnboardingPage,
})

function OnboardingPage() {
  const navigate = useNavigate()
  const { signOut } = useSignOut()
  const canSetUp = usePermission("manage", "workspace")

  return (
    <OnboardingLayout onSignOut={signOut}>
      {canSetUp ? (
        <OnboardingWizard onCompleted={() => navigate({ to: "/dashboard" })} />
      ) : (
        <OnboardingPending />
      )}
    </OnboardingLayout>
  )
}
