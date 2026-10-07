import {
  createFileRoute,
  redirect,
  stripSearchParams,
} from "@tanstack/react-router"
import { useCallback } from "react"

import {
  boardQueries,
  PipelineBoard,
  toBoardParams,
} from "@/features/pipelines"
import {
  ALL_RECORDS_VIEW,
  directoryQueries,
  ensureObjectDef,
  isPristineSearch,
  RECORD_LIST_DEFAULTS,
  recordListSearchSchema,
  RecordListPage,
  recordQueries,
  searchFromView,
  toListParams,
  useObjectDef,
  viewQueries,
  type RecordListSearch,
} from "@/features/records"

export const Route = createFileRoute("/_app/o/$objectKey/")({
  validateSearch: recordListSearchSchema,
  search: { middlewares: [stripSearchParams(RECORD_LIST_DEFAULTS)] },
  loaderDeps: ({ search }) => ({
    list: toListParams(search),
    board: toBoardParams(search),
    layout: search.layout,
    pristine: isPristineSearch(search),
  }),
  loader: async ({ context: { queryClient }, params, deps }) => {
    const objectDef = await ensureObjectDef(queryClient, params.objectKey)
    if (!objectDef) return

    const views = await queryClient.ensureQueryData(
      viewQueries.list(params.objectKey)
    )
    const defaultView = views.data.find(
      (view) => view.id === views.defaultViewId
    )
    if (deps.pristine && defaultView) {
      throw redirect({
        to: "/o/$objectKey",
        params,
        search: searchFromView(defaultView),
        replace: true,
      })
    }

    await Promise.all([
      queryClient.ensureQueryData(directoryQueries.users()),
      deps.layout === "kanban" && objectDef.pipeline
        ? queryClient.ensureQueryData(
            boardQueries.board(params.objectKey, deps.board)
          )
        : queryClient.ensureQueryData(
            recordQueries.list(params.objectKey, deps.list)
          ),
    ])
  },
  component: RecordListRoute,
})

function RecordListRoute() {
  const { objectKey } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const objectDef = useObjectDef(objectKey)

  const handleSearchChange = useCallback(
    (patch: Partial<RecordListSearch>) =>
      void navigate({
        search: (prev) => ({ ...prev, ...patch }),
        replace: true,
      }),
    [navigate]
  )

  const handleViewSelect = useCallback(
    (next: RecordListSearch | null) =>
      void navigate({
        search: next ?? { ...RECORD_LIST_DEFAULTS, view: ALL_RECORDS_VIEW },
      }),
    [navigate]
  )

  if (!objectDef) return null

  return (
    <RecordListPage
      key={objectKey}
      objectDef={objectDef}
      search={search}
      onSearchChange={handleSearchChange}
      onViewSelect={handleViewSelect}
      board={
        objectDef.pipeline ? (
          <PipelineBoard objectDef={objectDef} search={search} />
        ) : undefined
      }
    />
  )
}
