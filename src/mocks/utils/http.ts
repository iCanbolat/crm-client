import { HttpResponse } from "msw"

import type { ApiErrorEnvelope, FieldErrors } from "@/lib/api"
import { env } from "@/lib/env"
import i18n, { isLanguage, type Language } from "@/lib/i18n"

/** Prefixes a path with the configured API base (`/api` by default). */
export function apiPath(path: string) {
  return `${env.VITE_API_URL.replace(/\/+$/, "")}${path}`
}

export function apiError(
  status: number,
  code: string,
  message: string,
  extra: { fieldErrors?: FieldErrors; details?: unknown } = {}
) {
  return HttpResponse.json<ApiErrorEnvelope>(
    { error: { code, message, ...extra } },
    { status }
  )
}

export function getRequestLanguage(request: Request): Language {
  const header = request.headers.get("accept-language") ?? ""
  const language = header.split(",")[0]?.split("-")[0]?.trim()
  return isLanguage(language) ? language : "tr"
}

/** Translator for mock error messages, honouring the request language. */
export function getRequestT(request: Request) {
  return i18n.getFixedT(getRequestLanguage(request), "errors")
}
