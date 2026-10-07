import type { QueryClient } from "@tanstack/react-query"
import { redirect } from "@tanstack/react-router"

import {
  can,
  ForbiddenError,
  type Action,
  type Resource,
  type Subject,
} from "@/lib/rbac"

import type { Me, Membership } from "../api/auth.schemas"
import { ensureSession, resolveActiveMembership } from "./session"

export interface AuthContext {
  me: Me
  membership: Membership
  subject: Subject
}

/**
 * `beforeLoad` guard of protected layouts: unauthenticated visitors are sent
 * to the login page with a `redirect` back to where they wanted to go.
 */
export async function requireAuth(
  queryClient: QueryClient,
  location: { href: string }
): Promise<AuthContext> {
  const me = await ensureSession(queryClient)
  const membership = me ? resolveActiveMembership(me) : undefined

  if (!me || !membership) {
    throw redirect({ to: "/login", search: { redirect: location.href } })
  }

  return {
    me,
    membership,
    subject: { userId: me.user.id, role: membership.role },
  }
}

/** `beforeLoad` guard for role-restricted routes (renders the 403 page). */
export function requirePermission(
  auth: AuthContext,
  action: Action,
  resource: Resource
) {
  if (!can(auth.subject, action, resource)) throw new ForbiddenError()
}
