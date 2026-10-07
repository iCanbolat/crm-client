import { createFileRoute, redirect } from "@tanstack/react-router"

/** The quote list is the generic object list. */
export const Route = createFileRoute("/_app/quotes/")({
  beforeLoad: () => {
    throw redirect({ to: "/o/$objectKey", params: { objectKey: "quote" } })
  },
})
