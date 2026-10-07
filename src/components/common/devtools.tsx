import { lazy, Suspense } from "react"

const RouterDevtools = lazy(() =>
  import("@tanstack/react-router-devtools").then((module) => ({
    default: module.TanStackRouterDevtools,
  }))
)

const QueryDevtools = lazy(() =>
  import("@tanstack/react-query-devtools").then((module) => ({
    default: module.ReactQueryDevtools,
  }))
)

function isDevtoolsEnabled() {
  return (
    import.meta.env.DEV &&
    import.meta.env.MODE !== "test" &&
    // Hidden in Playwright runs so they never overlap the UI under test.
    !navigator.webdriver
  )
}

export function Devtools() {
  if (!isDevtoolsEnabled()) return null

  return (
    <Suspense fallback={null}>
      <RouterDevtools position="bottom-left" />
      <QueryDevtools buttonPosition="bottom-right" />
    </Suspense>
  )
}
