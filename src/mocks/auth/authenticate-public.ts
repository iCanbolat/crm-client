import { resolveSiteByHost } from "@/features/sites/mocks/store"
import type { SiteRow } from "@/features/sites/mocks/types"
import { env } from "@/lib/env"

import { apiError, getRequestT } from "../utils/http"

type PublicAuthResult =
  { ok: true; site: SiteRow } | { ok: false; response: Response }

/**
 * Public form site requests (B5.4) carry no session: the visited host in
 * `X-Public-Host` selects the tenant. Unknown hosts get a 404 that does not
 * reveal whether a tenant exists (TC-5.4-01).
 */
export function authenticatePublic(request: Request): PublicAuthResult {
  const host = (request.headers.get("x-public-host") ?? "").trim().toLowerCase()
  const site = host
    ? resolveSiteByHost(host, env.VITE_PUBLIC_FORMS_DOMAIN)
    : undefined
  if (!site) {
    return {
      ok: false,
      response: apiError(
        404,
        "SITE_NOT_FOUND",
        getRequestT(request)("mock.notFound")
      ),
    }
  }
  return { ok: true, site }
}
