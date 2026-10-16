import { z } from "zod"

import {
  findScopedRecordRow,
  getObjectDef,
} from "@/features/records/mocks/store"
import i18n from "@/lib/i18n"

/** Keys are built at runtime (error codes), so the typed `t` is widened. */
const translate = i18n.t as unknown as (
  key: string,
  options?: Record<string, unknown>
) => string
import { authenticate } from "@/mocks/auth/authenticate"
import { apiError, getRequestLanguage, getRequestT } from "@/mocks/utils/http"

/** Shared request helpers of the visa & education endpoints. */

export async function readJson(request: Request) {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}

export function requestT(request: Request) {
  const lng = getRequestLanguage(request)
  return (key: string, options: Record<string, unknown> = {}) =>
    translate(`visaEducation:${key}`, { lng, ...options })
}

export function validationError(request: Request, error: z.ZodError) {
  return apiError(422, "VALIDATION_ERROR", getRequestT(request)("validation"), {
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  })
}

/** Signed-in tenant + a record of one of `objectKeys` (404 otherwise). */
export function resolveRecord(
  request: Request,
  objectKey: string,
  id: string,
  objectKeys: readonly string[]
) {
  const auth = authenticate(request)
  if (!auth.ok) return { response: auth.response } as const
  const t = getRequestT(request)
  const workspaceId = auth.context.workspace.id
  const row =
    objectKeys.includes(objectKey) && getObjectDef(workspaceId, objectKey)
      ? findScopedRecordRow(auth.context, objectKey, id)
      : undefined
  if (!row) {
    return { response: apiError(404, "NOT_FOUND", t("mock.notFound")) } as const
  }
  return { auth: auth.context, row, workspaceId } as const
}
