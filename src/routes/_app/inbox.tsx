import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import { requirePermission } from "@/features/auth"
import {
  INBOX_SEARCH_DEFAULTS,
  InboxPage,
  inboxSearchSchema,
  messagingQueries,
} from "@/features/messaging"

export const Route = createFileRoute("/_app/inbox")({
  staticData: { crumb: "inbox" },
  validateSearch: inboxSearchSchema,
  search: { middlewares: [stripSearchParams(INBOX_SEARCH_DEFAULTS)] },
  beforeLoad: ({ context }) =>
    requirePermission(context.auth, "read", "conversation"),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(messagingQueries.status()),
  component: InboxRoute,
})

function InboxRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <InboxPage
      search={search}
      onSearchChange={(patch) =>
        void navigate({
          search: (prev) => ({ ...prev, ...patch }),
          // Opening a conversation is a step back can undo; filters replace.
          replace: !("c" in patch),
        })
      }
    />
  )
}
