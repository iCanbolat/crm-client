import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"
import { useState } from "react"
import { I18nextProvider } from "react-i18next"

import "./field-types"

import { PublicSite } from "@/features/public-site"
import { configureApiClient } from "@/lib/api"
import { reportError } from "@/lib/error-reporting"
import i18n from "@/lib/i18n"

/**
 * Public form site (B5.1): minimal providers, no session, no admin code.
 * Requests name the visited host so the API can resolve the tenant's site.
 */
export function PublicApp({ host }: { host: string }) {
  const [queryClient] = useState(() => {
    configureApiClient({ publicHost: host })
    // No toast cache: the public pages render their errors inline.
    return new QueryClient({
      queryCache: new QueryCache({
        onError: (error) => reportError(error, { source: "query" }),
      }),
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: false,
          staleTime: 60_000,
        },
        mutations: { retry: false },
      },
    })
  })

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <PublicSite host={host} pathname={window.location.pathname} />
      </I18nextProvider>
    </QueryClientProvider>
  )
}
