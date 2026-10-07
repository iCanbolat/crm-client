import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { requireAuth } from "@/features/auth"
import { LeadConversionProvider } from "@/features/leads"
import { metadataQueries, RecordServicesProvider } from "@/features/records"
import { AppShell } from "@/features/shell"
import { isOnboardingComplete, workspaceQueries } from "@/features/workspace"

/** Authenticated, onboarded area: everything behind the app shell. */
export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    const auth = await requireAuth(context.queryClient, location)
    const workspace = await context.queryClient.ensureQueryData(
      workspaceQueries.current()
    )
    if (!isOnboardingComplete(workspace.onboarding)) {
      throw redirect({ to: "/onboarding" })
    }
    return { auth }
  },
  // Object metadata drives navigation, lists and forms: load it up front.
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(metadataQueries.objects()),
  component: AppLayout,
})

function AppLayout() {
  return (
    <AppShell>
      <RecordServicesProvider>
        <LeadConversionProvider>
          <Outlet />
        </LeadConversionProvider>
      </RecordServicesProvider>
    </AppShell>
  )
}
