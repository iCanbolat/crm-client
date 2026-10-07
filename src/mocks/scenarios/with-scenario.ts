import {
  delay,
  type DefaultBodyType,
  type HttpResponseResolver,
  type PathParams,
} from "msw"

import type { FieldErrors } from "@/lib/api"

import { apiError, getRequestT } from "../utils/http"
import { getScenarioState } from "./scenario-store"

type RequestT = ReturnType<typeof getRequestT>

interface ScenarioOptions<
  Params extends PathParams<keyof Params>,
  RequestBody extends DefaultBodyType,
> {
  /** Response of the `empty` scenario (usually an empty page). */
  empty?: HttpResponseResolver<Params, RequestBody>
  /** Field errors of the `validation` scenario on mutating requests. */
  validationErrors?: (t: RequestT) => FieldErrors
  /**
   * Session-critical endpoints (login, token refresh, `/me`, workspace)
   * only get the latency; otherwise the `error` scenario would lock the user
   * out instead of exercising the screen under test.
   */
  critical?: boolean
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

/**
 * Wraps a resolver with the active dev scenario (latency, 5xx, 422, empty).
 * Every mock handler should go through this so the dev toolbar and the
 * E2E simulations can drive all endpoints consistently.
 */
export function withScenario<
  Params extends PathParams<keyof Params> = PathParams,
  RequestBody extends DefaultBodyType = DefaultBodyType,
>(
  resolver: HttpResponseResolver<Params, RequestBody>,
  options: ScenarioOptions<Params, RequestBody> = {}
): HttpResponseResolver<Params, RequestBody> {
  return async (info) => {
    const { scenario, delayMs, slowDelayMs } = getScenarioState()
    const latency = scenario === "slow" ? slowDelayMs : delayMs
    if (latency > 0) await delay(latency)

    if (options.critical) return resolver(info)

    const t = getRequestT(info.request)

    if (scenario === "error") {
      return apiError(500, "INTERNAL_ERROR", t("mock.internal"))
    }

    if (
      scenario === "validation" &&
      MUTATING_METHODS.has(info.request.method)
    ) {
      return apiError(422, "VALIDATION_ERROR", t("mock.validation"), {
        fieldErrors: options.validationErrors?.(t) ?? {},
      })
    }

    if (scenario === "empty" && options.empty) return options.empty(info)

    return resolver(info)
  }
}
