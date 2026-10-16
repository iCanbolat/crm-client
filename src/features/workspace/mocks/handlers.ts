import { http, HttpResponse } from "msw"
import { z } from "zod"

import type { FieldErrors } from "@/lib/api"
import {
  authenticate,
  authenticateUser,
  authorize,
} from "@/mocks/auth/authenticate"
import { db } from "@/mocks/db"
import {
  addMembership,
  createWorkspace,
  INVITE_TTL_MS,
  sendEmail,
} from "@/mocks/accounts"
import { issueTokens } from "@/mocks/auth/tokens"
import type { InviteRecord, MembershipRecord } from "@/mocks/db/seed"
import { activateModuleData } from "@/mocks/module-activation"
import { isModuleAvailable } from "@/mocks/modules"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import { apiError, apiPath, getRequestT } from "@/mocks/utils/http"

import {
  completeOnboardingInputSchema,
  createWorkspaceInputSchema,
  inviteInputSchema,
  inviteSignUpInputSchema,
  memberRoleInputSchema,
  saveOnboardingInputSchema,
  workspaceSettingsInputSchema,
  type InviteInput,
  type Member,
  type Vertical,
} from "../api/workspace.schemas"

type RequestT = ReturnType<typeof getRequestT>

function validationError(t: RequestT, error: z.ZodError) {
  return apiError(422, "VALIDATION_ERROR", t("validation"), {
    fieldErrors: z.flattenError(error).fieldErrors as FieldErrors,
  })
}

function unavailableVertical(t: RequestT, vertical: string | undefined) {
  if (!vertical || isModuleAvailable(vertical)) return null
  return apiError(422, "VALIDATION_ERROR", t("validation"), {
    fieldErrors: { vertical: [t("mock.moduleUnavailable")] },
  })
}

/** Creates pending invitations, skipping existing members and invitations. */
function createInvites(
  workspaceId: string,
  invitedBy: string,
  invites: readonly InviteInput[]
) {
  for (const invite of invites) {
    if (
      isMember(workspaceId, invite.email) ||
      isInvited(workspaceId, invite.email)
    ) {
      continue
    }
    const token = crypto.randomUUID()
    db.invites.create({
      id: crypto.randomUUID(),
      workspaceId,
      email: invite.email,
      role: invite.role,
      status: "pending",
      invitedAt: new Date().toISOString(),
      invitedBy,
      token,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
    })
    sendInviteEmail(workspaceId, invitedBy, invite.email, token)
  }
}

export function sendInviteEmail(
  workspaceId: string,
  invitedBy: string,
  email: string,
  token: string
) {
  const workspace = db.workspaces.findById(workspaceId)
  const inviter = db.users.findById(invitedBy)
  sendEmail({
    to: email,
    kind: "invite",
    subject: `${inviter?.name ?? ""} sizi ${workspace?.name ?? ""} çalışma alanına davet etti`,
    code: null,
    link: `/invite/${token}`,
  })
}

/** API shape of an invitation; managers also get the link to share. */
function toInvite(invite: InviteRecord, withLink: boolean) {
  const { id, email, role, status, invitedAt, expiresAt, token } = invite
  return {
    id,
    email,
    role,
    status,
    invitedAt,
    expiresAt,
    link: withLink && status === "pending" ? `/invite/${token}` : null,
  }
}

/** Member changes: never the owner, never oneself (Faz 10). */
function memberChangeError(
  t: RequestT,
  context: { user: { id: string } },
  membership: MembershipRecord | undefined
) {
  if (!membership) return apiError(404, "NOT_FOUND", t("mock.notFound"))
  if (membership.role === "owner") {
    return apiError(409, "OWNER_PROTECTED", t("mock.ownerProtected"))
  }
  if (membership.userId === context.user.id) {
    return apiError(409, "SELF_CHANGE", t("mock.selfChange"))
  }
  return null
}

/** Pending, unexpired invitation of a link; or the error to answer with. */
function resolveInvitation(t: RequestT, token: string) {
  const invite = db.invites.findFirst((item) => item.token === token)
  if (!invite || invite.status !== "pending") {
    return {
      response: apiError(404, "INVITE_INVALID", t("mock.inviteInvalid")),
    } as const
  }
  if (invite.expiresAt < new Date().toISOString()) {
    return {
      response: apiError(410, "INVITE_EXPIRED", t("mock.inviteExpired")),
    } as const
  }
  return { invite } as const
}

function acceptInvitation(invite: InviteRecord, userId: string) {
  if (
    !db.memberships.findFirst(
      (item) =>
        item.workspaceId === invite.workspaceId && item.userId === userId
    )
  ) {
    addMembership(userId, invite.workspaceId, invite.role)
  }
  db.invites.update(invite.id, { status: "accepted" })
}

function isMember(workspaceId: string, email: string) {
  const user = db.users.findFirst((item) => item.email === email)
  return (
    !!user &&
    !!db.memberships.findFirst(
      (item) => item.workspaceId === workspaceId && item.userId === user.id
    )
  )
}

function isInvited(workspaceId: string, email: string) {
  return !!db.invites.findFirst(
    (item) =>
      item.workspaceId === workspaceId &&
      item.email === email &&
      item.status === "pending"
  )
}

export const workspaceHandlers = [
  // No tenant yet: any signed-in user may open a further workspace.
  http.post(
    apiPath("/workspaces"),
    withScenario(async ({ request }) => {
      const auth = authenticateUser(request)
      if (!auth.ok) return auth.response
      const t = getRequestT(request)
      const parsed = createWorkspaceInputSchema.safeParse(
        await request.json().catch(() => null)
      )
      if (!parsed.success) return validationError(t, parsed.error)
      return HttpResponse.json(
        createWorkspace(auth.context.user.id, parsed.data.name),
        { status: 201 }
      )
    })
  ),

  http.get(
    apiPath("/workspace"),
    withScenario(
      ({ request }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response
        return HttpResponse.json(auth.context.workspace)
      },
      { critical: true }
    )
  ),

  http.put(
    apiPath("/workspace/onboarding"),
    withScenario(async ({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "manage", "workspace")
      if (denied) return denied

      const t = getRequestT(request)
      const { workspace } = auth.context
      if (workspace.onboarding.status === "completed") {
        return apiError(
          409,
          "ONBOARDING_COMPLETED",
          t("mock.onboardingCompleted")
        )
      }

      const parsed = saveOnboardingInputSchema.safeParse(await request.json())
      if (!parsed.success) return validationError(t, parsed.error)

      const unavailable = unavailableVertical(t, parsed.data.draft.vertical)
      if (unavailable) return unavailable

      const updated = db.workspaces.update(workspace.id, {
        onboarding: { status: "pending", ...parsed.data },
      })
      return HttpResponse.json(updated)
    })
  ),

  http.post(
    apiPath("/workspace/onboarding"),
    withScenario(async ({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "manage", "workspace")
      if (denied) return denied

      const t = getRequestT(request)
      const { workspace, user } = auth.context
      if (workspace.onboarding.status === "completed") {
        return apiError(
          409,
          "ONBOARDING_COMPLETED",
          t("mock.onboardingCompleted")
        )
      }

      const parsed = completeOnboardingInputSchema.safeParse(
        await request.json()
      )
      if (!parsed.success) return validationError(t, parsed.error)

      const { company, vertical, invites } = parsed.data
      const unavailable = unavailableVertical(t, vertical)
      if (unavailable) return unavailable
      if (workspace.vertical && workspace.vertical !== vertical) {
        return apiError(409, "VERTICAL_LOCKED", t("mock.verticalLocked"))
      }

      createInvites(workspace.id, user.id, invites)
      if (!workspace.modules.includes(vertical)) {
        activateModuleData(workspace.id, vertical)
      }
      const updated = db.workspaces.update(workspace.id, {
        ...company,
        vertical,
        modules: [vertical],
        onboarding: { status: "completed", step: 3, draft: {} },
      })
      return HttpResponse.json(updated)
    })
  ),

  http.patch(
    apiPath("/workspace/settings"),
    withScenario(async ({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "manage", "member")
      if (denied) return denied

      const t = getRequestT(request)
      const parsed = workspaceSettingsInputSchema.safeParse(
        await request.json()
      )
      if (!parsed.success) return validationError(t, parsed.error)
      return HttpResponse.json(
        db.workspaces.update(auth.context.workspace.id, parsed.data)
      )
    })
  ),

  http.post(
    apiPath("/workspace/modules/:moduleId/activate"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "manage", "workspace")
      if (denied) return denied

      const moduleId = String(params.moduleId)
      if (!isModuleAvailable(moduleId)) {
        return apiError(
          422,
          "MODULE_UNAVAILABLE",
          getRequestT(request)("mock.moduleUnavailable")
        )
      }

      // One sector per workspace (Faz 10): a workspace without a sector
      // gets this one; another sector needs another workspace.
      const { workspace } = auth.context
      if (workspace.vertical && workspace.vertical !== moduleId) {
        return apiError(
          409,
          "VERTICAL_LOCKED",
          getRequestT(request)("mock.verticalLocked")
        )
      }
      if (!workspace.modules.includes(moduleId)) {
        activateModuleData(workspace.id, moduleId)
      }
      const updated = db.workspaces.update(workspace.id, {
        vertical: moduleId as Vertical,
        modules: [moduleId],
      })
      return HttpResponse.json(updated)
    })
  ),

  http.get(
    apiPath("/workspace/members"),
    withScenario(({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "read", "member")
      if (denied) return denied

      const members = db.memberships
        .findMany((item) => item.workspaceId === auth.context.workspace.id)
        .flatMap((membership): Member[] => {
          const user = db.users.findById(membership.userId)
          return user
            ? [
                {
                  userId: user.id,
                  name: user.name,
                  email: user.email,
                  avatarUrl: user.avatarUrl,
                  role: membership.role,
                  joinedAt: membership.joinedAt,
                },
              ]
            : []
        })
        .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))

      return HttpResponse.json({ data: members })
    })
  ),

  http.get(
    apiPath("/workspace/invites"),
    withScenario(({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "read", "member")
      if (denied) return denied

      const canManage = !authorize(request, auth.context, "manage", "member")
      const invites = db.invites
        .findMany((item) => item.workspaceId === auth.context.workspace.id)
        .map((invite) => toInvite(invite, canManage))
        .sort((a, b) => b.invitedAt.localeCompare(a.invitedAt))

      return HttpResponse.json({ data: invites })
    })
  ),

  http.post(
    apiPath("/workspace/invites"),
    withScenario(
      async ({ request }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response
        const denied = authorize(request, auth.context, "manage", "member")
        if (denied) return denied

        const t = getRequestT(request)
        const parsed = inviteInputSchema.safeParse(await request.json())
        if (!parsed.success) return validationError(t, parsed.error)

        const { workspace, user } = auth.context
        const { email } = parsed.data
        if (isMember(workspace.id, email)) {
          return apiError(422, "VALIDATION_ERROR", t("validation"), {
            fieldErrors: { email: [t("mock.alreadyMember")] },
          })
        }
        if (isInvited(workspace.id, email)) {
          return apiError(422, "VALIDATION_ERROR", t("validation"), {
            fieldErrors: { email: [t("mock.alreadyInvited")] },
          })
        }

        createInvites(workspace.id, user.id, [parsed.data])
        const invite = db.invites.findFirst(
          (item) =>
            item.workspaceId === workspace.id &&
            item.email === email &&
            item.status === "pending"
        )!
        return HttpResponse.json(toInvite(invite, true), { status: 201 })
      },
      { validationErrors: (t) => ({ email: [t("mock.validation")] }) }
    )
  ),

  /* ------------------------------------------------------------------------
   * Team management (Faz 10)
   * --------------------------------------------------------------------- */

  http.patch(
    apiPath("/workspace/members/:userId"),
    withScenario(async ({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "manage", "member")
      if (denied) return denied

      const t = getRequestT(request)
      const membership = db.memberships.findById(
        `${auth.context.workspace.id}:${String(params.userId)}`
      )
      const refused = memberChangeError(t, auth.context, membership)
      if (refused) return refused
      const parsed = memberRoleInputSchema.safeParse(
        await request.json().catch(() => null)
      )
      if (!parsed.success) return validationError(t, parsed.error)

      db.memberships.update(membership!.id, { role: parsed.data.role })
      return new HttpResponse(null, { status: 204 })
    })
  ),

  http.delete(
    apiPath("/workspace/members/:userId"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "manage", "member")
      if (denied) return denied

      const t = getRequestT(request)
      const membership = db.memberships.findById(
        `${auth.context.workspace.id}:${String(params.userId)}`
      )
      const refused = memberChangeError(t, auth.context, membership)
      if (refused) return refused

      db.memberships.delete(membership!.id)
      // Their records go back to the shared pool.
      for (const row of db.records.findMany(
        (item) =>
          item.workspaceId === membership!.workspaceId &&
          item.values.ownerId === membership!.userId
      )) {
        db.records.update(row.id, { values: { ...row.values, ownerId: null } })
      }
      return new HttpResponse(null, { status: 204 })
    })
  ),

  http.delete(
    apiPath("/workspace/invites/:id"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "manage", "member")
      if (denied) return denied

      const invite = db.invites.findById(String(params.id))
      if (!invite || invite.workspaceId !== auth.context.workspace.id) {
        return apiError(404, "NOT_FOUND", getRequestT(request)("mock.notFound"))
      }
      db.invites.update(invite.id, { status: "revoked" })
      return new HttpResponse(null, { status: 204 })
    })
  ),

  http.post(
    apiPath("/workspace/invites/:id/resend"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "manage", "member")
      if (denied) return denied

      const invite = db.invites.findById(String(params.id))
      if (
        !invite ||
        invite.workspaceId !== auth.context.workspace.id ||
        invite.status !== "pending"
      ) {
        return apiError(404, "NOT_FOUND", getRequestT(request)("mock.notFound"))
      }
      const updated = db.invites.update(invite.id, {
        expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
      })!
      sendInviteEmail(
        invite.workspaceId,
        auth.context.user.id,
        invite.email,
        invite.token
      )
      return HttpResponse.json(toInvite(updated, true))
    })
  ),

  /* ------------------------------------------------------------------------
   * Invitation links (`/invite/:token`, Faz 10)
   * --------------------------------------------------------------------- */

  http.get(
    apiPath("/invites/:token"),
    withScenario(({ request, params }) => {
      const resolved = resolveInvitation(
        getRequestT(request),
        String(params.token)
      )
      if ("response" in resolved) return resolved.response
      const { invite } = resolved
      const workspace = db.workspaces.findById(invite.workspaceId)!
      return HttpResponse.json({
        email: invite.email,
        role: invite.role,
        workspaceName: workspace.name,
        workspaceLogoUrl: workspace.logoUrl,
        vertical: workspace.vertical,
        inviterName: db.users.findById(invite.invitedBy)?.name ?? "",
        expiresAt: invite.expiresAt,
      })
    })
  ),

  http.post(
    apiPath("/invites/:token/accept"),
    withScenario(({ request, params }) => {
      const auth = authenticateUser(request)
      if (!auth.ok) return auth.response
      const t = getRequestT(request)
      const resolved = resolveInvitation(t, String(params.token))
      if ("response" in resolved) return resolved.response
      const { invite } = resolved
      if (invite.email !== auth.context.user.email) {
        return apiError(
          403,
          "INVITE_EMAIL_MISMATCH",
          t("mock.inviteEmailMismatch")
        )
      }
      acceptInvitation(invite, auth.context.user.id)
      return HttpResponse.json({ workspaceId: invite.workspaceId })
    })
  ),

  http.post(
    apiPath("/invites/:token/register"),
    withScenario(async ({ request, params }) => {
      const t = getRequestT(request)
      const resolved = resolveInvitation(t, String(params.token))
      if ("response" in resolved) return resolved.response
      const { invite } = resolved
      const parsed = inviteSignUpInputSchema.safeParse(
        await request.json().catch(() => null)
      )
      if (!parsed.success) return validationError(t, parsed.error)
      if (db.users.findFirst((item) => item.email === invite.email)) {
        return apiError(409, "EMAIL_TAKEN", t("mock.emailTaken"))
      }

      // The link proves the address: no separate verification needed.
      const user = db.users.create({
        id: `usr_${crypto.randomUUID().slice(0, 8)}`,
        email: invite.email,
        name: parsed.data.name,
        avatarUrl: null,
        emailVerified: true,
        password: parsed.data.password,
      })
      acceptInvitation(invite, user.id)
      return HttpResponse.json(
        { ...issueTokens(user.id), workspaceId: invite.workspaceId },
        { status: 201 }
      )
    })
  ),
]
