const AUTH_PATHS = ["/login", "/forgot-password"]

/**
 * Accepts only same-origin, absolute paths as post-login redirect targets,
 * so `?redirect=` can never be abused as an open redirect.
 */
export function sanitizeRedirect(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  if (!value.startsWith("/") || value.startsWith("//")) return undefined
  if (value.includes("\\")) return undefined

  const pathname = value.split(/[?#]/)[0] ?? ""
  if (AUTH_PATHS.some((path) => pathname === path)) return undefined

  return value
}
