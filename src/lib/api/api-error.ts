export type FieldErrors = Record<string, string[]>

/**
 * - `http`: the server answered with a non-2xx status
 * - `network`: the request never reached the server (offline, DNS, CORS…)
 * - `invalid_response`: the response did not match the expected zod contract
 */
export type ApiErrorKind = "http" | "network" | "invalid_response"

export interface ApiErrorInit {
  kind: ApiErrorKind
  status: number
  code: string
  message: string
  fieldErrors?: FieldErrors
  details?: unknown
  cause?: unknown
}

export class ApiError extends Error {
  override readonly name = "ApiError"
  readonly kind: ApiErrorKind
  readonly status: number
  readonly code: string
  readonly fieldErrors?: FieldErrors
  readonly details?: unknown

  constructor(init: ApiErrorInit) {
    super(init.message, { cause: init.cause })
    this.kind = init.kind
    this.status = init.status
    this.code = init.code
    this.fieldErrors = init.fieldErrors
    this.details = init.details
  }

  get isValidationError() {
    return this.status === 422 && this.fieldErrors !== undefined
  }

  get isServerError() {
    return this.status >= 500
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}
