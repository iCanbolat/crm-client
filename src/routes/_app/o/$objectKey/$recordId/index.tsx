import { createFileRoute, stripSearchParams } from "@tanstack/react-router"
import { z } from "zod"

import { RecordTimeline } from "@/features/activities"
import { ConvertLeadButton } from "@/features/leads"
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
  component: RecordDetailRoute,
})

function RecordDetailRoute() {
  const { objectKey, recordId } = Route.useParams()
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  const objectDef = useObjectDef(objectKey)
  const title = useRecordCrumb(objectKey, recordId)
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
      actions={(record) =>
        objectKey === "lead" ? <ConvertLeadButton lead={record} /> : null
      }
      onDeleted={() =>
        void navigate({ to: "/o/$objectKey", params: { objectKey } })
      }
    />
  )
}
