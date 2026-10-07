import { describe, expect, it } from "vitest"

import { ApiError, getErrorMessage, type ApiErrorKind } from "@/lib/api"
import i18n from "@/lib/i18n"

const apiError = (
  status: number,
  code: string,
  kind: ApiErrorKind = "http",
  message = "server message"
) => new ApiError({ kind, status, code, message })

describe("getErrorMessage", () => {
  it.each([
    ["network", apiError(0, "NETWORK_ERROR", "network"), "errors:network"],
    [
      "invalid response",
      apiError(200, "INVALID_RESPONSE", "invalid_response"),
      "errors:invalidResponse",
    ],
    ["5xx", apiError(500, "INTERNAL_ERROR"), "errors:server"],
    ["401 without envelope", apiError(401, "HTTP_401"), "errors:unauthorized"],
    ["403 without envelope", apiError(403, "HTTP_403"), "errors:forbidden"],
    ["404 without envelope", apiError(404, "HTTP_404"), "errors:notFound"],
    ["422 without envelope", apiError(422, "HTTP_422"), "errors:validation"],
    ["409 without envelope", apiError(409, "HTTP_409"), "errors:unknown"],
  ] as const)("maps %s to a generic localized message", (_, error, key) => {
    expect(getErrorMessage(error)).toBe(i18n.t(key))
  })

  it("prefers the localized message from the API envelope for 4xx", () => {
    expect(getErrorMessage(apiError(409, "CONFLICT", "http", "Çakışma"))).toBe(
      "Çakışma"
    )
  })

  it("falls back to a generic message for unknown errors", () => {
    expect(getErrorMessage(new Error("boom"))).toBe(
      "Beklenmeyen bir hata oluştu."
    )
    expect(getErrorMessage("nope")).toBe("Beklenmeyen bir hata oluştu.")
  })
})
