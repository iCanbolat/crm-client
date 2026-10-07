import {
  createFileRoute,
  notFound,
  stripSearchParams,
} from "@tanstack/react-router"
import { z } from "zod"

import { ensureObjectDef, useObjectDef } from "@/features/records"
import { OBJECT_SETTINGS_TABS, ObjectSettingsPage } from "@/features/settings"

const searchSchema = z.object({
  tab: z.enum(OBJECT_SETTINGS_TABS).default("fields").catch("fields"),
})

export const Route = createFileRoute("/_app/settings/objects/$objectKey")({
  staticData: { crumb: "objectSettings" },
  validateSearch: searchSchema,
  search: { middlewares: [stripSearchParams({ tab: "fields" })] },
  loader: async ({ context, params }) => {
    if (!(await ensureObjectDef(context.queryClient, params.objectKey))) {
      throw notFound()
    }
  },
  component: ObjectSettingsRoute,
})

function ObjectSettingsRoute() {
  const { objectKey } = Route.useParams()
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  const objectDef = useObjectDef(objectKey)
  if (!objectDef) return null

  return (
    <ObjectSettingsPage
      objectDef={objectDef}
      tab={tab}
      onTabChange={(next) =>
        void navigate({ search: { tab: next }, replace: true })
      }
    />
  )
}
