import { http, HttpResponse } from "msw"
import { z } from "zod"

import type { FieldErrors } from "@/lib/api"
import { authenticate, authorize } from "@/mocks/auth/authenticate"
import { db } from "@/mocks/db"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import { apiError, apiPath, getRequestT } from "@/mocks/utils/http"

import {
  createDomainInputSchema,
  updateSiteInputSchema,
} from "../api/sites.schemas"
import {
  domainsOf,
  ensureSite,
  findDomainRow,
  isHostnameTaken,
  isSubdomainTaken,
  publishedFormsOf,
  toDomain,
  toSite,
} from "./store"

const flatten = (error: z.ZodError) =>
  z.flattenError(error).fieldErrors as FieldErrors

const randomToken = () =>
  `crm-verify=${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`

/** Site settings (B5.2) and custom domains (B5.3). */
export const siteHandlers = [
  http.get(
    apiPath("/sites"),
    withScenario(({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "read", "site")
      if (denied) return denied
      return HttpResponse.json(toSite(ensureSite(auth.context.workspace.id)))
    })
  ),

  http.patch(
    apiPath("/sites"),
    withScenario(
      async ({ request }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response
        const denied = authorize(request, auth.context, "update", "site")
        if (denied) return denied

        const t = getRequestT(request)
        const workspaceId = auth.context.workspace.id
        const parsed = updateSiteInputSchema
          .partial()
          .safeParse(await request.json())
        if (!parsed.success) {
          return apiError(422, "VALIDATION_ERROR", t("validation"), {
            fieldErrors: flatten(parsed.error),
          })
        }
        const input = parsed.data
        if (input.subdomain && isSubdomainTaken(input.subdomain, workspaceId)) {
          return apiError(422, "SUBDOMAIN_TAKEN", t("mock.subdomainTaken"), {
            fieldErrors: { subdomain: [t("mock.subdomainTaken")] },
          })
        }
        if (
          input.defaultFormId &&
          !publishedFormsOf(workspaceId).some(
            (form) => form.id === input.defaultFormId
          )
        ) {
          return apiError(422, "VALIDATION_ERROR", t("validation"), {
            fieldErrors: { defaultFormId: [t("mock.formNotPublished")] },
          })
        }

        const site = ensureSite(workspaceId)
        const updated = db.sites.update(site.id, {
          ...input,
          updatedAt: new Date().toISOString(),
        })!
        return HttpResponse.json(toSite(updated))
      },
      {
        validationErrors: (t) => ({ subdomain: [t("mock.subdomainTaken")] }),
      }
    )
  ),

  http.get(
    apiPath("/sites/domains"),
    withScenario(({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "read", "site")
      if (denied) return denied
      return HttpResponse.json({
        data: domainsOf(auth.context.workspace.id).map(toDomain),
      })
    })
  ),

  http.post(
    apiPath("/sites/domains"),
    withScenario(
      async ({ request }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response
        const denied = authorize(request, auth.context, "update", "site")
        if (denied) return denied

        const t = getRequestT(request)
        const parsed = createDomainInputSchema.safeParse(await request.json())
        if (!parsed.success) {
          return apiError(422, "VALIDATION_ERROR", t("validation"), {
            fieldErrors: flatten(parsed.error),
          })
        }
        const { hostname } = parsed.data
        if (isHostnameTaken(hostname)) {
          return apiError(422, "DOMAIN_TAKEN", t("mock.domainTaken"), {
            fieldErrors: { hostname: [t("mock.domainTaken")] },
          })
        }

        const workspaceId = auth.context.workspace.id
        const now = new Date().toISOString()
        const row = db.domains.create({
          id: `dom_${crypto.randomUUID().slice(0, 8)}`,
          workspaceId,
          hostname,
          status: "pending_dns",
          // The first domain becomes primary once it is active.
          isPrimary: domainsOf(workspaceId).length === 0,
          verifyToken: randomToken(),
          failureReason: null,
          checkStartedAt: now,
          verifiedAt: null,
          createdAt: now,
        })
        return HttpResponse.json(toDomain(row), { status: 201 })
      },
      { validationErrors: (t) => ({ hostname: [t("mock.domainTaken")] }) }
    )
  ),

  http.get(
    apiPath("/sites/domains/:id"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "read", "site")
      if (denied) return denied
      const row = findDomainRow(auth.context.workspace.id, String(params.id))
      if (!row) {
        return apiError(404, "NOT_FOUND", getRequestT(request)("mock.notFound"))
      }
      return HttpResponse.json(toDomain(row))
    })
  ),

  // "Retry": restart the verification run of a failed or stuck domain.
  http.post(
    apiPath("/sites/domains/:id/verify"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "update", "site")
      if (denied) return denied
      const row = findDomainRow(auth.context.workspace.id, String(params.id))
      if (!row) {
        return apiError(404, "NOT_FOUND", getRequestT(request)("mock.notFound"))
      }
      if (row.status === "active") return HttpResponse.json(toDomain(row))
      const updated = db.domains.update(row.id, {
        status: "pending_dns",
        failureReason: null,
        checkStartedAt: new Date().toISOString(),
      })!
      return HttpResponse.json(toDomain(updated))
    })
  ),

  http.post(
    apiPath("/sites/domains/:id/primary"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "update", "site")
      if (denied) return denied
      const t = getRequestT(request)
      const workspaceId = auth.context.workspace.id
      const row = findDomainRow(workspaceId, String(params.id))
      if (!row) return apiError(404, "NOT_FOUND", t("mock.notFound"))
      if (row.status !== "active") {
        return apiError(409, "DOMAIN_NOT_ACTIVE", t("mock.domainNotActive"))
      }
      for (const domain of domainsOf(workspaceId)) {
        db.domains.update(domain.id, { isPrimary: domain.id === row.id })
      }
      return HttpResponse.json({
        data: domainsOf(workspaceId).map(toDomain),
      })
    })
  ),

  http.delete(
    apiPath("/sites/domains/:id"),
    withScenario(({ request, params }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const denied = authorize(request, auth.context, "update", "site")
      if (denied) return denied
      const row = findDomainRow(auth.context.workspace.id, String(params.id))
      if (!row) {
        return apiError(404, "NOT_FOUND", getRequestT(request)("mock.notFound"))
      }
      db.domains.delete(row.id)
      return new HttpResponse(null, { status: 204 })
    })
  ),
]
