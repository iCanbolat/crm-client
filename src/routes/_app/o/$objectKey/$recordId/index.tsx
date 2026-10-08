import { createFileRoute, stripSearchParams } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { RecordTimeline } from "@/features/activities"
import { ConvertLeadButton } from "@/features/leads"
import {
  messagingQueries,
  RecordWhatsappTab,
  useHasWhatsappTab,
} from "@/features/messaging"
import {
  RECORD_TABS,
  RecordDetailPage,
  useObjectDef,
  useRecordCrumb,
} from "@/features/records"

const searchSchema = z.object({
  tab: z.enum(RECORD_TABS).default("details").catch("details"),
})

export const Route = createFileRoute("/_app/o/$objectKey/$recordId/")({
  validateSearch: searchSchema,
  search: { middlewares: [stripSearchParams({ tab: "details" })] },
  // The WhatsApp tab depends on the channel; never blocks the page.
  loader: ({ context }) =>
    context.queryClient.prefetchQuery(messagingQueries.status()),
  component: RecordDetailRoute,
})

function RecordDetailRoute() {
  const { objectKey, recordId } = Route.useParams()
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  const objectDef = useObjectDef(objectKey)
  const title = useRecordCrumb(objectKey, recordId)
  const { t } = useTranslation("messaging")
  const hasWhatsapp = useHasWhatsappTab(objectDef)
  if (!objectDef) return null

  return (
    <RecordDetailPage
      key={recordId}
      objectDef={objectDef}
      recordId={recordId}
      tab={tab}
      onTabChange={(next) =>
        void navigate({ search: { tab: next }, replace: true })
      }
      timeline={
        <RecordTimeline
          objectKey={objectKey}
          recordId={recordId}
          recordLabel={title ?? recordId}
        />
      }
      extraTabs={
        hasWhatsapp
          ? [
              {
                value: "whatsapp",
                label: t("recordTab.tab"),
                content: (
                  <RecordWhatsappTab
                    objectDef={objectDef}
                    recordId={recordId}
                  />
                ),
              },
            ]
          : []
      }
      actions={(record) =>
        objectKey === "lead" ? <ConvertLeadButton lead={record} /> : null
      }
      onDeleted={() =>
        void navigate({ to: "/o/$objectKey", params: { objectKey } })
      }
    />
  )
}
