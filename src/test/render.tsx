import type { QueryClient } from "@tanstack/react-query"
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { render, screen, type RenderOptions } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactElement } from "react"

import { AppProviders } from "@/app/providers/app-providers"
import { createAppRouter } from "@/app/router"
import { createQueryClient } from "@/lib/query-client"
import type { SeedUserKey } from "@/mocks/db/seed"

import { signInAs } from "./auth"

export function createTestQueryClient() {
  return createQueryClient({
    queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
    mutations: { retry: false },
  })
}

interface ProviderOptions extends Omit<RenderOptions, "wrapper"> {
  queryClient?: QueryClient
}

interface RouteOptions extends ProviderOptions {
  /** Signs in as this seed user before rendering (see `signInAs`). */
  as?: SeedUserKey
}

/**
 * Renders a component with all app providers inside a throwaway router,
 * so `Link` and router hooks work without the real route tree.
 */
export async function renderWithProviders(
  ui: ReactElement,
  { queryClient = createTestQueryClient(), ...options }: ProviderOptions = {}
) {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => ui }),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  })
  const user = userEvent.setup()

  const result = render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
    options
  )
  await router.load()

  return { ...result, user, queryClient, router }
}

/** Renders the real route tree at `path` (memory history). */
export async function renderRoute(
  path: string,
  { queryClient = createTestQueryClient(), as, ...options }: RouteOptions = {}
) {
  if (as) signInAs(as)

  const router = createAppRouter(queryClient, {
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  const user = userEvent.setup()

  const result = render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
    options
  )

  return { ...result, user, queryClient, router }
}

export { screen }
