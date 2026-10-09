import { createFileRoute } from "@tanstack/react-router"

import {
  NotificationPreferencesPage,
  notificationQueries,
} from "@/features/notifications"

/** Personal notification preferences: every member manages their own. */
export const Route = createFileRoute("/_app/settings/notifications")({
  staticData: { crumb: "notifications" },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(notificationQueries.preferences()),
  component: NotificationPreferencesPage,
})
