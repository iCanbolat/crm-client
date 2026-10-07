import { http, HttpResponse } from "msw"

import { queryRecordValues } from "@/engine/records"
import { authenticate } from "@/mocks/auth/authenticate"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import { apiError, apiPath, getRequestT } from "@/mocks/utils/http"
import {
  getObjectDef,
  parseFilters,
  recordsOf,
  toCrmRecord,
} from "@/features/records/mocks/store"

import { BOARD_COLUMN_LIMIT, type Board } from "../api/pipelines.schemas"
import { sumByCurrency } from "../lib/board"

export const pipelinesHandlers = [
  // Registered before `/records/:objectKey/:id`, which would match "board".
  http.get(
    apiPath("/records/:objectKey/board"),
    withScenario(
      ({ request, params }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response
        const t = getRequestT(request)
        const workspaceId = auth.context.workspace.id
        const def = getObjectDef(workspaceId, String(params.objectKey))
        if (!def?.pipeline) {
          return apiError(404, "NOT_FOUND", t("mock.notFound"))
        }

        const url = new URL(request.url)
        const rows = queryRecordValues(def, recordsOf(workspaceId, def.key), {
          q: url.searchParams.get("q")?.trim() || undefined,
          filters: parseFilters(url.searchParams.get("filters")),
          sort: { field: "updatedAt", direction: "desc" },
        })
        const pipeline = def.pipeline
        const board: Board = {
          columns: pipeline.stages.map((stage) => {
            const inStage = rows.filter(
              (row) => row.values[pipeline.field] === stage.key
            )
            return {
              stage: stage.key,
              count: inStage.length,
              totals: sumByCurrency(inStage, pipeline.amountField),
              records: inStage
                .slice(0, BOARD_COLUMN_LIMIT)
                .map((row) => toCrmRecord(def, row)),
            }
          }),
        }
        return HttpResponse.json(board)
      },
      {
        empty: ({ request, params }) => {
          const auth = authenticate(request)
          if (!auth.ok) return auth.response
          const def = getObjectDef(
            auth.context.workspace.id,
            String(params.objectKey)
          )
          return HttpResponse.json({
            columns: (def?.pipeline?.stages ?? []).map((stage) => ({
              stage: stage.key,
              count: 0,
              totals: [],
              records: [],
            })),
          })
        },
      }
    )
  ),
]
