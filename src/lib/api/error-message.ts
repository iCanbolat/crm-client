import i18n from "@/lib/i18n"

import { isApiError } from "./api-error"

const STATUS_MESSAGE_KEYS = {
  401: "errors:unauthorized",
  403: "errors:forbidden",
  404: "errors:notFound",
  422: "errors:validation",
} as const

/** Turns any thrown value into a localized, user-facing message. */
export function getErrorMessage(error: unknown): string {
  if (!isApiError(error)) return i18n.t("errors:unknown")

  if (error.kind === "network") return i18n.t("errors:network")
  if (error.kind === "invalid_response") return i18n.t("errors:invalidResponse")
  if (error.isServerError) return i18n.t("errors:server")

  // A message from the API error envelope is already localized (Accept-Language).
  const hasServerMessage = !error.code.startsWith("HTTP_")
  if (hasServerMessage) return error.message

  const key =
    STATUS_MESSAGE_KEYS[error.status as keyof typeof STATUS_MESSAGE_KEYS]
  return i18n.t(key ?? "errors:unknown")
}
