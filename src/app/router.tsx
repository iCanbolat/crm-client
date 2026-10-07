import type { QueryClient } from "@tanstack/react-query"
import { createRouter, type RouterHistory } from "@tanstack/react-router"

import "./modules"

import { LoadingSkeleton } from "@/components/common/loading-skeleton"
import { NotFoundPage } from "@/components/common/not-found"
import { RouteError } from "@/components/common/route-error"
import { bindApiClientToSession } from "@/features/auth"
import type { CrumbKey } from "@/locales"
import { routeTree } from "@/routeTree.gen"

export function createAppRouter(
  queryClient: QueryClient,
  options: { history?: RouterHistory } = {}
) {
  const router = createRouter({
    routeTree,
    history: options.history,
    context: { queryClient },
    // Route loaders prefetch through TanStack Query, so let Query own caching.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultPendingComponent: () => (
      <LoadingSkeleton variant="page" className="py-6" />
    ),
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: NotFoundPage,
  })

  // Unrecoverable 401 (refresh failed): rerun the guards, which send the
  // user to the login page with a redirect back to the current URL.
  bindApiClientToSession({
    onSessionExpired: () => void router.invalidate(),
  })

  return router
}

export type AppRouter = ReturnType<typeof createAppRouter>

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter
  }
  interface StaticDataRouteOption {
    /** Breadcrumb label key (`shell:crumbs.*`). */
    crumb?: CrumbKey
  }
}
