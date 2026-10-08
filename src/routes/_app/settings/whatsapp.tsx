import { createFileRoute, stripSearchParams } from "@tanstack/react-router"
import { z } from "zod"

import { requirePermission } from "@/features/auth"
import {
  messagingQueries,
  WHATSAPP_SETTINGS_TABS,
  WhatsappSettingsPage,
} from "@/features/messaging"

const searchSchema = z.object({
  tab: z.enum(WHATSAPP_SETTINGS_TABS).default("connection").catch("connection"),
})

export const Route = createFileRoute("/_app/settings/whatsapp")({
  staticData: { crumb: "whatsapp" },
  validateSearch: searchSchema,
  search: { middlewares: [stripSearchParams({ tab: "connection" })] },
  beforeLoad: ({ context }) =>
    requirePermission(context.auth, "read", "channel"),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(messagingQueries.channel()),
      context.queryClient.ensureQueryData(messagingQueries.templates()),
    ]),
  component: WhatsappSettingsRoute,
})

function WhatsappSettingsRoute() {
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <WhatsappSettingsPage
      tab={tab}
      onTabChange={(next) =>
        void navigate({ search: { tab: next }, replace: true })
      }
    />
  )
}
