import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import {
  directoryQueries,
  RecordFormPage,
  recordQueries,
  useObjectDef,
} from "@/features/records"

export const Route = createFileRoute("/_app/o/$objectKey/$recordId/edit")({
  staticData: { crumb: "edit" },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(directoryQueries.users()),
  component: EditRecordRoute,
})

function EditRecordRoute() {
  const { objectKey, recordId } = Route.useParams()
  const navigate = Route.useNavigate()
  const objectDef = useObjectDef(objectKey)
  const { data: record } = useSuspenseQuery(
    recordQueries.detail(objectKey, recordId)
  )
  if (!objectDef) return null

  const toDetail = () =>
    void navigate({
      to: "/o/$objectKey/$recordId",
      params: { objectKey, recordId },
    })

  return (
    <RecordFormPage
      objectDef={objectDef}
      record={record}
      onSubmitted={toDetail}
      onCancel={toDetail}
    />
  )
}
