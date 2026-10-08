import { useQuery } from "@tanstack/react-query"

import { usePermission } from "@/features/auth"

import { messagingQueries } from "../api/messaging.queries"

/** Unread conversations of the current user (sidebar badge). */
export function useInboxUnread() {
  const canRead = usePermission("read", "conversation")
  const { data } = useQuery({
    ...messagingQueries.summary(),
    enabled: canRead,
  })
  return data?.unread ?? 0
}
