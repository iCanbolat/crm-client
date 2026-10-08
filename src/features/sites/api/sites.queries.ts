import { queryOptions } from "@tanstack/react-query"

import { fetchDomains, fetchSite } from "./sites.api"
import { siteKeys } from "./sites.keys"
import { isDomainPending } from "./sites.schemas"

/** Poll while a domain is being verified (B5.3). */
export const DOMAIN_POLL_MS = 1_000

export const siteQueries = {
  current: () =>
    queryOptions({
      queryKey: siteKeys.current(),
      queryFn: ({ signal }) => fetchSite(signal),
    }),
  domains: () =>
    queryOptions({
      queryKey: siteKeys.domains(),
      queryFn: ({ signal }) => fetchDomains(signal),
      // Stops by itself once every domain is active or failed (TC-5.3-02).
      refetchInterval: (query) =>
        query.state.data?.some((domain) => isDomainPending(domain.status))
          ? DOMAIN_POLL_MS
          : false,
    }),
}
