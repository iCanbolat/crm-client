import { createFileRoute, redirect } from "@tanstack/react-router"

/** `/` has no page of its own: the app layout guards and routes onward. */
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" })
  },
})
