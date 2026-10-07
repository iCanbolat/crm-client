import type { Workspace } from "@/features/workspace"
import {
  can,
  type Action,
  type Resource,
  type Subject,
  type Target,
} from "@/lib/rbac"

import { db } from "../db"
import type { MembershipRecord, MockUser } from "../db/seed"
import { apiError, getRequestT } from "../utils/http"
import { readToken } from "./tokens"

export interface UserContext {
  user: MockUser
}

export interface TenantContext extends UserContext {
  workspace: Workspace
  membership: MembershipRecord
  subject: Subject
}

type AuthResult<T> =
  { ok: true; context: T } | { ok: false; response: Response }

function fail(response: Response) {
  return { ok: false as const, response }
}

/** Verifies the bearer token (401 with a machine readable code otherwise). */
export function authenticateUser(request: Request): AuthResult<UserContext> {
  const t = getRequestT(request)
  const header = request.headers.get("authorization") ?? ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : ""

  if (!token)
    return fail(apiError(401, "UNAUTHENTICATED", t("mock.unauthenticated")))

  const check = readToken("access", token)
  if (!check.ok) {
    return check.reason === "expired"
      ? fail(apiError(401, "TOKEN_EXPIRED", t("mock.tokenExpired")))
      : fail(apiError(401, "INVALID_TOKEN", t("mock.invalidToken")))
  }

  const user = db.users.findById(check.payload.sub)
  if (!user || db.revokedTokens.findById(check.payload.jti)) {
    return fail(apiError(401, "INVALID_TOKEN", t("mock.invalidToken")))
  }

  return { ok: true, context: { user } }
}

/** Bearer token + `X-Tenant-Id` membership check. */
export function authenticate(request: Request): AuthResult<TenantContext> {
  const userResult = authenticateUser(request)
  if (!userResult.ok) return userResult

  const t = getRequestT(request)
  const { user } = userResult.context
  const workspaceId = request.headers.get("x-tenant-id")
  if (!workspaceId)
    return fail(apiError(400, "TENANT_REQUIRED", t("mock.tenantRequired")))

  const membership = db.memberships.findFirst(
    (item) => item.userId === user.id && item.workspaceId === workspaceId
  )
  const workspace = db.workspaces.findById(workspaceId)
  if (!membership || !workspace) {
    return fail(apiError(403, "NOT_MEMBER", t("mock.notMember")))
  }

  return {
    ok: true,
    context: {
      user,
      workspace,
      membership,
      subject: { userId: user.id, role: membership.role },
    },
  }
}

/** Same policy as the UI (`lib/rbac`): returns a 403 response when denied. */
export function authorize(
  request: Request,
  context: TenantContext,
  action: Action,
  resource: Resource,
  target?: Target
): Response | null {
  if (can(context.subject, action, resource, target)) return null
  return apiError(403, "FORBIDDEN", getRequestT(request)("mock.forbidden"))
}
