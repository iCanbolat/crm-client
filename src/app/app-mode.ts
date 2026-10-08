/**
 * Which app a host serves (plan §4.3, B5.1): the admin CRM on the app host,
 * the public form site everywhere else (platform subdomains such as
 * `acme.forms.localhost` and tenants' custom domains).
 */
export type AppMode = { mode: "admin" } | { mode: "public"; host: string }

export interface ResolveAppModeOptions {
  appHost: string
  /** `?__host=` simulates a custom domain; honoured only in dev/test. */
  allowHostOverride: boolean
}

/** Hosts that always serve the admin app (plain local dev, E2E). */
const LOCAL_ADMIN_HOSTS = new Set(["localhost", "[::1]"])

/** IP literals never carry a tenant site (no CNAME points at them). */
const isIpLiteral = (host: string) =>
  /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[")

/** Lower-cased host name without the port. */
export function normalizeHost(host: string) {
  const value = host.trim().toLowerCase()
  if (value.startsWith("[")) return value.slice(0, value.indexOf("]") + 1)
  return value.split(":")[0] ?? ""
}

export function resolveAppMode(
  host: string,
  search: string,
  options: ResolveAppModeOptions
): AppMode {
  if (options.allowHostOverride) {
    const override = new URLSearchParams(search).get("__host")?.trim()
    if (override) return { mode: "public", host: normalizeHost(override) }
  }

  const hostname = normalizeHost(host)
  if (
    hostname === normalizeHost(options.appHost) ||
    LOCAL_ADMIN_HOSTS.has(hostname) ||
    isIpLiteral(hostname)
  ) {
    return { mode: "admin" }
  }
  return { mode: "public", host: hostname }
}
