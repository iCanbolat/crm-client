import type { z } from "zod"

import { env } from "@/lib/env"
import i18n from "@/lib/i18n"

import { ApiError } from "./api-error"
import { apiErrorEnvelopeSchema } from "./schemas"

type QueryValue = string | number | boolean | null | undefined
export type QueryParams = Record<string, QueryValue | QueryValue[]>

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export interface RequestOptions<TSchema extends z.ZodType | undefined> {
  query?: QueryParams
  body?: unknown
  headers?: HeadersInit
  signal?: AbortSignal
  /** zod contract the response is parsed with. */
  schema?: TSchema
  /**
   * Send the access token and refresh it on 401 (default `true`).
   * Disable for public endpoints such as login or token refresh.
   */
  auth?: boolean
}

type ResponseOf<TSchema> = TSchema extends z.ZodType
  ? z.output<TSchema>
  : unknown

interface ApiClientConfig {
  baseUrl: string
  getAccessToken?: () => string | null | undefined
  getTenantId?: () => string | null | undefined
  /** Called once on 401; resolves to a fresh access token or `null`. */
  refreshAccessToken?: () => Promise<string | null>
  /** Called when a 401 could not be recovered by refreshing the token. */
  onAuthFailure?: () => void
  /**
   * Public form site (B5.1): every request names the visited host in
   * `X-Public-Host` instead of carrying a session and a tenant.
   */
  publicHost?: string
}

let config: ApiClientConfig = { baseUrl: env.VITE_API_URL }

/** The auth feature registers its token/tenant getters and refresh flow here. */
export function configureApiClient(next: Partial<ApiClientConfig>) {
  config = { ...config, ...next }
}

/** The client serves the public form site (no session, no tenant). */
export function isPublicApiClient() {
  return Boolean(config.publicHost)
}

export function buildUrl(path: string, query?: QueryParams): URL {
  const base = config.baseUrl.replace(/\/+$/, "")
  const url = new URL(
    `${base}/${path.replace(/^\/+/, "")}`,
    window.location.origin
  )

  for (const [key, value] of Object.entries(query ?? {})) {
    const values = Array.isArray(value) ? value : [value]
    for (const item of values) {
      if (item === undefined || item === null || item === "") continue
      url.searchParams.append(key, String(item))
    }
  }

  return url
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError"
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return undefined

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function toHttpError(response: Response): Promise<ApiError> {
  const payload = await readJson(response)
  const envelope = apiErrorEnvelopeSchema.safeParse(payload)

  if (envelope.success) {
    const { code, message, fieldErrors, details } = envelope.data.error
    return new ApiError({
      kind: "http",
      status: response.status,
      code,
      message,
      fieldErrors,
      details,
    })
  }

  return new ApiError({
    kind: "http",
    status: response.status,
    code: `HTTP_${response.status}`,
    message: `Request failed with status ${response.status}`,
    details: payload,
  })
}

async function request<TSchema extends z.ZodType | undefined>(
  method: HttpMethod,
  path: string,
  options: RequestOptions<TSchema> = {},
  isRetry = false
): Promise<ResponseOf<TSchema>> {
  const useAuth = options.auth !== false
  const headers = new Headers(options.headers)
  headers.set("Accept", "application/json")
  headers.set("Accept-Language", i18n.resolvedLanguage ?? i18n.language)

  if (config.publicHost) {
    headers.set("X-Public-Host", config.publicHost)
  } else {
    const token = useAuth ? config.getAccessToken?.() : undefined
    if (token) headers.set("Authorization", `Bearer ${token}`)

    const tenantId = config.getTenantId?.()
    if (tenantId) headers.set("X-Tenant-Id", tenantId)
  }

  let body: BodyInit | undefined
  if (options.body instanceof FormData) {
    body = options.body
  } else if (options.body !== undefined) {
    headers.set("Content-Type", "application/json")
    body = JSON.stringify(options.body)
  }

  let response: Response
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body,
      signal: options.signal,
    })
  } catch (error) {
    // Cancellation is not an API failure; let TanStack Query handle it.
    if (isAbortError(error)) throw error

    throw new ApiError({
      kind: "network",
      status: 0,
      code: "NETWORK_ERROR",
      message: "Network request failed",
      cause: error,
    })
  }

  if (response.status === 401 && useAuth && !config.publicHost) {
    // Expired access token: refresh once and replay the request.
    if (!isRetry && config.refreshAccessToken) {
      const nextToken = await config.refreshAccessToken()
      if (nextToken) return request(method, path, options, true)
    }
    config.onAuthFailure?.()
  }

  if (!response.ok) throw await toHttpError(response)

  const payload = response.status === 204 ? undefined : await readJson(response)
  if (!options.schema) return payload as ResponseOf<TSchema>

  const parsed = options.schema.safeParse(payload)
  if (!parsed.success) {
    throw new ApiError({
      kind: "invalid_response",
      status: response.status,
      code: "INVALID_RESPONSE",
      message: `Response of ${method} ${path} does not match the expected contract`,
      details: parsed.error.issues,
    })
  }

  return parsed.data as ResponseOf<TSchema>
}

export const apiClient = {
  get: <TSchema extends z.ZodType | undefined = undefined>(
    path: string,
    options?: RequestOptions<TSchema>
  ) => request("GET", path, options),
  post: <TSchema extends z.ZodType | undefined = undefined>(
    path: string,
    options?: RequestOptions<TSchema>
  ) => request("POST", path, options),
  put: <TSchema extends z.ZodType | undefined = undefined>(
    path: string,
    options?: RequestOptions<TSchema>
  ) => request("PUT", path, options),
  patch: <TSchema extends z.ZodType | undefined = undefined>(
    path: string,
    options?: RequestOptions<TSchema>
  ) => request("PATCH", path, options),
  delete: <TSchema extends z.ZodType | undefined = undefined>(
    path: string,
    options?: RequestOptions<TSchema>
  ) => request("DELETE", path, options),
}
