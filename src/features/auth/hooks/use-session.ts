import { useSuspenseQuery } from "@tanstack/react-query"

import { can, type Action, type Resource, type Target } from "@/lib/rbac"

import { authQueries } from "../api/auth.queries"
import { resolveActiveMembership } from "../lib/session"
import { useSessionState } from "../lib/session-store"

/** Signed-in user, their memberships and the role in the active workspace. */
export function useSession() {
  const { data: me } = useSuspenseQuery(authQueries.me())
  const activeWorkspaceId = useSessionState((state) => state.activeWorkspaceId)
  const membership = resolveActiveMembership(me, activeWorkspaceId)

  return {
    user: me.user,
    memberships: me.memberships,
    membership,
    role: membership?.role ?? null,
    subject: membership ? { userId: me.user.id, role: membership.role } : null,
  }
}

export function usePermission(
  action: Action,
  resource: Resource,
  target?: Target
) {
  const { subject } = useSession()
  return can(subject, action, resource, target)
}
