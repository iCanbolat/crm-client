import { http, HttpResponse } from "msw"
import { z } from "zod"

import type { FieldErrors } from "@/lib/api"
import { authenticateUser } from "@/mocks/auth/authenticate"
import { issueTokens, readToken } from "@/mocks/auth/tokens"
import { db } from "@/mocks/db"
import type { MockUser } from "@/mocks/db/seed"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import { apiError, apiPath, getRequestT } from "@/mocks/utils/http"

type RequestT = ReturnType<typeof getRequestT>

function validationError(t: RequestT, error: z.ZodError) {
  return apiError(422, "VALIDATION_ERROR", t("validation"), {
    fieldErrors: z.flattenError(error).fieldErrors as FieldErrors,
  })
}

import {
  MAX_VERIFICATION_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  createWorkspace,
  sendVerificationCode,
} from "@/mocks/accounts"

import {
  forgotPasswordInputSchema,
  loginInputSchema,
  refreshInputSchema,
  registerInputSchema,
  verifyEmailInputSchema,
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
              vertical: workspace.vertical,
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
      emailVerified: user.emailVerified,
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

  /* ------------------------------------------------------------------------
   * Self sign-up (Faz 10): account + an empty workspace it owns, then the
   * e-mail is confirmed with a 6-digit code before the onboarding.
   * --------------------------------------------------------------------- */

  http.post(
    apiPath("/auth/register"),
    withScenario(
      async ({ request }) => {
        const t = getRequestT(request)
        const parsed = registerInputSchema.safeParse(
          await request.json().catch(() => null)
        )
        if (!parsed.success) return validationError(t, parsed.error)

        const { name, email, password, companyName } = parsed.data
        if (db.users.findFirst((item) => item.email === email)) {
          return apiError(422, "EMAIL_TAKEN", t("validation"), {
            fieldErrors: { email: [t("mock.emailTaken")] },
          })
        }

        const user = db.users.create({
          id: `usr_${crypto.randomUUID().slice(0, 8)}`,
          email,
          name,
          avatarUrl: null,
          emailVerified: false,
          password,
        })
        createWorkspace(user.id, companyName)
        sendVerificationCode(user)
        return HttpResponse.json(issueTokens(user.id), { status: 201 })
      },
      { critical: true }
    )
  ),

  http.post(
    apiPath("/auth/verify-email"),
    withScenario(
      async ({ request }) => {
        const auth = authenticateUser(request)
        if (!auth.ok) return auth.response
        const t = getRequestT(request)
        const { user } = auth.context
        if (user.emailVerified) return HttpResponse.json(buildMe(user))

        const parsed = verifyEmailInputSchema.safeParse(
          await request.json().catch(() => null)
        )
        if (!parsed.success) return validationError(t, parsed.error)

        const pending = db.emailVerifications.findById(user.id)
        const invalid = (code: string, message: string) =>
          apiError(422, code, t("validation"), {
            fieldErrors: { code: [message] },
          })
        if (!pending || pending.attempts >= MAX_VERIFICATION_ATTEMPTS) {
          return invalid("CODE_EXPIRED", t("mock.codeExpired"))
        }
        if (pending.expiresAt < new Date().toISOString()) {
          return invalid("CODE_EXPIRED", t("mock.codeExpired"))
        }
        if (pending.code !== parsed.data.code) {
          db.emailVerifications.update(user.id, {
            attempts: pending.attempts + 1,
          })
          return invalid("INVALID_CODE", t("mock.invalidCode"))
        }

        db.emailVerifications.delete(user.id)
        const verified = db.users.update(user.id, { emailVerified: true })!
        return HttpResponse.json(buildMe(verified))
      },
      { critical: true }
    )
  ),

  http.post(
    apiPath("/auth/verify-email/resend"),
    withScenario(
      ({ request }) => {
        const auth = authenticateUser(request)
        if (!auth.ok) return auth.response
        const t = getRequestT(request)
        const { user } = auth.context
        if (user.emailVerified) return new HttpResponse(null, { status: 204 })

        const pending = db.emailVerifications.findById(user.id)
        const wait = pending
          ? new Date(pending.sentAt).getTime() + RESEND_COOLDOWN_MS - Date.now()
          : 0
        if (wait > 0) {
          return apiError(429, "RESEND_TOO_SOON", t("mock.resendTooSoon"), {
            details: { retryAfter: Math.ceil(wait / 1000) },
          })
        }
        sendVerificationCode(user)
        return new HttpResponse(null, { status: 202 })
      },
      { critical: true }
    )
  ),
]
