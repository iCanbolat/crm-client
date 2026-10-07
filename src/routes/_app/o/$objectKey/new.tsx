import { createFileRoute, useRouter } from "@tanstack/react-router"

import {
  directoryQueries,
  RecordFormPage,
  useObjectDef,
} from "@/features/records"

export const Route = createFileRoute("/_app/o/$objectKey/new")({
  staticData: { crumb: "new" },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(directoryQueries.users()),
  component: NewRecordRoute,
})

function NewRecordRoute() {
  const { objectKey } = Route.useParams()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const objectDef = useObjectDef(objectKey)
  if (!objectDef) return null

  return (
    <RecordFormPage
      objectDef={objectDef}
      onSubmitted={(record) =>
        void navigate({
          to: "/o/$objectKey/$recordId",
          params: { objectKey, recordId: record.id },
        })
      }
      onCancel={() =>
        router.history.canGoBack()
          ? router.history.back()
          : void navigate({ to: "/o/$objectKey", params: { objectKey } })
      }
    />
  )
}
