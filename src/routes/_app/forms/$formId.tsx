import { createFileRoute, notFound, Outlet } from "@tanstack/react-router"

import { formQueries } from "@/features/form-builder"
import { isApiError } from "@/lib/api"

export const Route = createFileRoute("/_app/forms/$formId")({
  staticData: { crumb: "form" },
  loader: async ({ context, params }) => {
    try {
      await context.queryClient.ensureQueryData(
        formQueries.detail(params.formId)
      )
    } catch (error) {
      if (isApiError(error) && error.status === 404) throw notFound()
      throw error
    }
  },
  component: Outlet,
})
