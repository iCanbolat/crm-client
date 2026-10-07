import type { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router"

import { Devtools } from "@/components/common/devtools"
import { NotFoundPage } from "@/components/common/not-found"

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: RootNotFound,
})

function RootLayout() {
  return (
    <>
      <Outlet />
      <Devtools />
    </>
  )
}

/** Unknown URLs outside the app shell. */
function RootNotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center">
      <NotFoundPage />
    </main>
  )
}
