import { http, HttpResponse } from "msw"
import { z } from "zod"

import type { FieldErrors } from "@/lib/api"
import { authenticateUser } from "@/mocks/auth/authenticate"
import { issueTokens, readToken } from "@/mocks/auth/tokens"
import { db } from "@/mocks/db"
import type { MockUser } from "@/mocks/db/seed"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import { apiError, apiPath, getRequestT } from "@/mocks/utils/http"

import {
  forgotPasswordInputSchema,
  loginInputSchema,
  refreshInputSchema,
  type Me,
} from "../api/auth.schemas"

function revoke(jti: string) {
  if (!db.revokedTokens.findById(jti)) {
    db.revokedTokens.create({ id: jti, revokedAt: new Date().toISOString() })
  }
}

export function buildMe(user: MockUser): Me {
  const memberships = db.memberships
    .findMany((item) => item.userId === user.id)
    .flatMap((membership) => {
      const workspace = db.workspaces.findById(membership.workspaceId)
      return workspace
        ? [
            {
              workspaceId: workspace.id,
              workspaceName: workspace.name,
              workspaceLogoUrl: workspace.logoUrl,
              role: membership.role,
            },
          ]
        : []
    })

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    },
    memberships,
  }
}

export const authHandlers = [
  http.post(
    apiPath("/auth/login"),
    withScenario(
      async ({ request }) => {
        const t = getRequestT(request)
        const parsed = loginInputSchema.safeParse(await request.json())
        if (!parsed.success) {
          return apiError(422, "VALIDATION_ERROR", t("validation"), {
            fieldErrors: z.flattenError(parsed.error)
              .fieldErrors as FieldErrors,
          })
        }

        const { email, password } = parsed.data
        const user = db.users.findFirst((item) => item.email === email)
        if (!user || user.password !== password) {
          return apiError(
            401,
            "INVALID_CREDENTIALS",
            t("mock.invalidCredentials")
          )
        }

        return HttpResponse.json(issueTokens(user.id))
      },
      { critical: true }
    )
  ),

  http.post(
    apiPath("/auth/refresh"),
    withScenario(
      async ({ request }) => {
        const t = getRequestT(request)
        const parsed = refreshInputSchema.safeParse(await request.json())
        const check = parsed.success
          ? readToken("refresh", parsed.data.refreshToken)
          : null

        if (!check?.ok || db.revokedTokens.findById(check.payload.jti)) {
          return apiError(401, "INVALID_TOKEN", t("mock.invalidToken"))
        }
        const user = db.users.findById(check.payload.sub)
        if (!user) return apiError(401, "INVALID_TOKEN", t("mock.invalidToken"))

        // Rotation: a refresh token can be used exactly once.
        revoke(check.payload.jti)
        return HttpResponse.json(issueTokens(user.id))
      },
      { critical: true }
    )
  ),

  http.post(
    apiPath("/auth/logout"),
    withScenario(
      async ({ request }) => {
        const body = (await request.json().catch(() => null)) as {
          refreshToken?: unknown
        } | null
        if (typeof body?.refreshToken === "string") {
          const check = readToken("refresh", body.refreshToken)
          if (check.ok) revoke(check.payload.jti)
        }
        return new HttpResponse(null, { status: 204 })
      },
      { critical: true }
    )
  ),

  http.get(
    apiPath("/me"),
    withScenario(
      ({ request }) => {
        const auth = authenticateUser(request)
        if (!auth.ok) return auth.response
        return HttpResponse.json(buildMe(auth.context.user))
      },
      { critical: true }
    )
  ),

  http.post(
    apiPath("/auth/forgot-password"),
    withScenario(
      async ({ request }) => {
        const t = getRequestT(request)
        const parsed = forgotPasswordInputSchema.safeParse(await request.json())
        if (!parsed.success) {
          return apiError(422, "VALIDATION_ERROR", t("validation"), {
            fieldErrors: z.flattenError(parsed.error)
              .fieldErrors as FieldErrors,
          })
        }
        // Same answer for unknown emails: no account enumeration.
        return new HttpResponse(null, { status: 202 })
      },
      { validationErrors: (t) => ({ email: [t("mock.validation")] }) }
    )
  ),
]
