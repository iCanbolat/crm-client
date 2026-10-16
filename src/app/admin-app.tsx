import { RouterContextProvider, RouterProvider } from "@tanstack/react-router"
import { lazy, Suspense } from "react"

import { createQueryClient } from "@/lib/query-client"

import { AppProviders } from "./providers/app-providers"
import { createAppRouter } from "./router"

const queryClient = createQueryClient()
const router = createAppRouter(queryClient)

const DevToolbar =
  import.meta.env.VITE_ENABLE_MSW === "true"
    ? lazy(() => import("@/mocks/dev-toolbar/dev-toolbar"))
    : null

export function AdminApp() {
  return (
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
      {DevToolbar ? (
        // Outside RouterProvider: the router context still lets the outbox
        // render invitation links.
        <RouterContextProvider router={router}>
          <Suspense fallback={null}>
            <DevToolbar
              onSignedIn={async () => {
                await router.navigate({ to: "/dashboard" })
                await router.invalidate()
              }}
            />
          </Suspense>
        </RouterContextProvider>
      ) : null}
    </AppProviders>
  )
}
