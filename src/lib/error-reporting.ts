import { isApiError } from "@/lib/api"
import { isForbiddenError } from "@/lib/rbac"

/**
 * Error tracking hook (B7.4). The app reports unexpected errors here; a
 * Sentry (or similar) integration only has to call `setErrorReporter` at
 * startup — nothing else in the app knows about the vendor.
 */
export type ErrorSource =
  "route" | "query" | "mutation" | "window" | "unhandledrejection"

export interface ErrorContext {
  source: ErrorSource
  /** e.g. the query key or the route id. */
  tags?: Record<string, string>
}

export type ErrorReporter = (error: unknown, context: ErrorContext) => void

/** Development: the console; production without a vendor: nothing. */
const defaultReporter: ErrorReporter = (error, context) => {
  if (import.meta.env.DEV && import.meta.env.MODE !== "test") {
    console.error(`[error-reporting] ${context.source}`, error, context.tags)
  }
}

let reporter: ErrorReporter = defaultReporter

/** Installs the vendor reporter; returns a function restoring the previous one. */
export function setErrorReporter(next: ErrorReporter) {
  const previous = reporter
  reporter = next
  return () => {
    reporter = previous
  }
}

/**
 * Expected outcomes are not bugs: 4xx answers (validation, 403, 404),
 * offline requests and route guards. Server errors and broken API
 * contracts are.
 */
export function isReportable(error: unknown) {
  if (isForbiddenError(error)) return false
  if (isApiError(error)) {
    return error.kind === "invalid_response" || error.isServerError
  }
  return true
}

export function reportError(error: unknown, context: ErrorContext) {
  if (!isReportable(error)) return
  try {
    reporter(error, context)
  } catch {
    // A failing reporter must never break the app.
  }
}

/** Uncaught errors and unhandled promise rejections of the page. */
export function installGlobalErrorHandlers(target: Window = window) {
  const onError = (event: ErrorEvent) =>
    reportError(event.error ?? event.message, { source: "window" })
  const onRejection = (event: PromiseRejectionEvent) =>
    reportError(event.reason, { source: "unhandledrejection" })
  target.addEventListener("error", onError)
  target.addEventListener("unhandledrejection", onRejection)
  return () => {
    target.removeEventListener("error", onError)
    target.removeEventListener("unhandledrejection", onRejection)
  }
}
