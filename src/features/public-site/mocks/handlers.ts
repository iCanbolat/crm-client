import { http, HttpResponse } from "msw"
import { z } from "zod"

import { validateSubmission } from "@/engine/forms"
import type { FieldErrors } from "@/lib/api"
import { authenticatePublic } from "@/mocks/auth/authenticate-public"
import { db } from "@/mocks/db"
import { emitMockEvent } from "@/mocks/events"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import { apiError, apiPath, getRequestT } from "@/mocks/utils/http"
import { countSubmissions } from "@/features/form-builder/mocks/store"
import { publishedFormOf, toSite } from "@/features/sites/mocks/store"
import {
  convertSubmission,
  extractUtm,
} from "@/features/submissions/mocks/process"

import {
  publicEventSchema,
  submitFormInputSchema,
  type PublicForm,
  type PublicSite,
} from "../api/public.schemas"

const flatten = (error: z.ZodError) =>
  z.flattenError(error).fieldErrors as FieldErrors

/** Public form site API (B5.4/B5.5): no session, tenant from the host. */
export const publicSiteHandlers = [
  http.get(
    apiPath("/public/sites/resolve"),
    withScenario(({ request }) => {
      const auth = authenticatePublic(request)
      if (!auth.ok) return auth.response
      const site = toSite(auth.site)
      const defaultForm = site.publishedForms.find(
        (form) => form.id === site.defaultFormId
      )
      return HttpResponse.json<PublicSite>({
        brand: site.brand,
        seo: site.seo,
        legal: site.legal,
        defaultFormSlug: defaultForm?.slug ?? null,
      })
    })
  ),

  http.get(
    apiPath("/public/forms/:slug"),
    withScenario(({ request, params }) => {
      const auth = authenticatePublic(request)
      if (!auth.ok) return auth.response
      const published = publishedFormOf(
        auth.site.workspaceId,
        String(params.slug)
      )
      if (!published) {
        return apiError(
          404,
          "FORM_NOT_FOUND",
          getRequestT(request)("mock.notFound")
        )
      }
      return HttpResponse.json<PublicForm>({
        slug: published.form.slug,
        name: published.form.name,
        version: published.version.version,
        content: published.content,
      })
    })
  ),

  http.post(
    apiPath("/public/events"),
    withScenario(async ({ request }) => {
      const auth = authenticatePublic(request)
      if (!auth.ok) return auth.response
      const parsed = publicEventSchema.safeParse(await request.json())
      if (!parsed.success) return new HttpResponse(null, { status: 204 })
      const published = publishedFormOf(
        auth.site.workspaceId,
        parsed.data.formSlug
      )
      if (published) {
        db.forms.update(published.form.id, { views: published.form.views + 1 })
      }
      return new HttpResponse(null, { status: 204 })
    })
  ),

  http.post(
    apiPath("/public/forms/:slug/submissions"),
    withScenario(
      async ({ request, params }) => {
        const auth = authenticatePublic(request)
        if (!auth.ok) return auth.response
        const t = getRequestT(request)
        const workspaceId = auth.site.workspaceId
        const published = publishedFormOf(workspaceId, String(params.slug))
        if (!published)
          return apiError(404, "FORM_NOT_FOUND", t("mock.notFound"))

        const parsed = submitFormInputSchema.safeParse(await request.json())
        if (!parsed.success) {
          return apiError(422, "VALIDATION_ERROR", t("validation"), {
            fieldErrors: flatten(parsed.error),
          })
        }
        const { answers, meta } = parsed.data
        const { form, content } = published

        // Bots fill the hidden trap: answer like a success, store nothing.
        if (content.settings.honeypot && meta.honeypot) {
          return HttpResponse.json({ ok: true }, { status: 201 })
        }

        const limit = content.settings.maxSubmissions
        if (limit != null && countSubmissions(form.id) >= limit) {
          return apiError(422, "FORM_CLOSED", t("mock.formClosed"))
        }

        const validation = validateSubmission(content, answers)
        if (!validation.ok) {
          return apiError(422, "VALIDATION_ERROR", t("validation"), {
            fieldErrors: validation.fieldErrors,
          })
        }

        const row = db.submissions.create({
          id: `sub_${crypto.randomUUID().slice(0, 12)}`,
          workspaceId,
          formId: form.id,
          formVersion: published.version.version,
          answers: validation.answers,
          status: "new",
          record: null,
          utm: extractUtm(meta.pageUrl, validation.answers),
          referrer: meta.referrer || null,
          pageUrl: meta.pageUrl || null,
          embedded: meta.embedded,
          language: meta.language,
          error: null,
          createdAt: new Date().toISOString(),
        })
        const processed = convertSubmission(row, t)
        emitMockEvent({
          workspaceId,
          type: "submission.created",
          objectKey: processed.record?.objectKey ?? "submission",
          recordId: processed.record?.id ?? row.id,
          data: { formId: form.id, submissionId: row.id },
          actorId: null,
        })
        return HttpResponse.json({ ok: true }, { status: 201 })
      },
      { validationErrors: (t) => ({ email: [t("mock.validation")] }) }
    )
  ),
]
