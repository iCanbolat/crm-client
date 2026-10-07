import { http, HttpResponse } from "msw"
import { z } from "zod"

import type { FieldErrors } from "@/lib/api"
import { authenticate, authorize } from "@/mocks/auth/authenticate"
import { db } from "@/mocks/db"
import { activateModuleData } from "@/mocks/module-activation"
import { isModuleAvailable } from "@/mocks/modules"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import { apiError, apiPath, getRequestT } from "@/mocks/utils/http"

import {
  completeOnboardingInputSchema,
  inviteInputSchema,
  saveOnboardingInputSchema,
  type InviteInput,
  type Member,
} from "../api/workspace.schemas"

type RequestT = ReturnType<typeof getRequestT>

function validationError(t: RequestT, error: z.ZodError) {
  return apiError(422, "VALIDATION_ERROR", t("validation"), {
    fieldErrors: z.flattenError(error).fieldErrors as FieldErrors,
  })
}

function unavailableModules(modules: readonly string[]) {
  return modules.filter((moduleId) => !isModuleAvailable(moduleId))
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
    db.invites.create({
      id: crypto.randomUUID(),
      workspaceId,
      email: invite.email,
      role: invite.role,
      status: "pending",
      invitedAt: new Date().toISOString(),
      invitedBy,
    })
  }
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

      const modules = parsed.data.draft.modules ?? []
      if (unavailableModules(modules).length) {
        return apiError(422, "VALIDATION_ERROR", t("validation"), {
          fieldErrors: { modules: [t("mock.moduleUnavailable")] },
        })
      }

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

      const { company, modules, invites } = parsed.data
      if (unavailableModules(modules).length) {
        return apiError(422, "VALIDATION_ERROR", t("validation"), {
          fieldErrors: { modules: [t("mock.moduleUnavailable")] },
        })
      }

      createInvites(workspace.id, user.id, invites)
      for (const moduleId of modules) {
        if (!workspace.modules.includes(moduleId)) {
          activateModuleData(workspace.id, moduleId)
        }
      }
      const updated = db.workspaces.update(workspace.id, {
        ...company,
        modules: Array.from(new Set([...workspace.modules, ...modules])),
        onboarding: { status: "completed", step: 3, draft: {} },
      })
      return HttpResponse.json(updated)
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

      const { workspace } = auth.context
      if (!workspace.modules.includes(moduleId)) {
        activateModuleData(workspace.id, moduleId)
      }
      const updated = db.workspaces.update(workspace.id, {
        modules: Array.from(new Set([...workspace.modules, moduleId])),
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

      const invites = db.invites
        .findMany((item) => item.workspaceId === auth.context.workspace.id)
        .map(({ id, email, role, status, invitedAt }) => ({
          id,
          email,
          role,
          status,
          invitedAt,
        }))
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
          (item) => item.workspaceId === workspace.id && item.email === email
        )!
        const { id, role, status, invitedAt } = invite
        return HttpResponse.json(
          { id, email, role, status, invitedAt },
          { status: 201 }
        )
      },
      { validationErrors: (t) => ({ email: [t("mock.validation")] }) }
    )
  ),
]
