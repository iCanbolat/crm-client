import { createFileRoute, notFound, Outlet } from "@tanstack/react-router"

import { ensureObjectDef, recordQueries } from "@/features/records"
import { isApiError } from "@/lib/api"

export const Route = createFileRoute("/_app/o/$objectKey/$recordId")({
  staticData: { crumb: "record" },
  loader: async ({ context: { queryClient }, params }) => {
    const objectDef = await ensureObjectDef(queryClient, params.objectKey)
    if (!objectDef) return
    try {
      await queryClient.ensureQueryData(
        recordQueries.detail(params.objectKey, params.recordId)
      )
    } catch (error) {
      if (isApiError(error) && error.status === 404) throw notFound()
      throw error
    }
  },
  component: Outlet,
})
