import { http, HttpResponse } from "msw"

import { getRecordTitle, label } from "@/engine/metadata"
import { matchesSearch } from "@/engine/records"
import { listObjectDefs, recordsOf } from "@/features/records/mocks/store"
import { authenticate } from "@/mocks/auth/authenticate"
import { db } from "@/mocks/db"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import { apiPath, getRequestLanguage } from "@/mocks/utils/http"
import { applySearch } from "@/mocks/utils/list"

import { SEARCH_MIN_LENGTH, type SearchHit } from "../api/search.schemas"

const MAX_HITS = 8

export const shellHandlers = [
  http.get(
    apiPath("/search"),
    withScenario(
      ({ request }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response

        const q = new URL(request.url).searchParams.get("q")?.trim() ?? ""
        if (q.length < SEARCH_MIN_LENGTH) return HttpResponse.json({ data: [] })

        const workspaceId = auth.context.workspace.id
        const language = getRequestLanguage(request)
        const records: SearchHit[] = listObjectDefs(workspaceId).flatMap(
          (def) =>
            recordsOf(workspaceId, def.key)
              .filter((row) => matchesSearch(def, row.values, q))
              .map((row) => ({
                id: row.id,
                type: "record" as const,
                objectKey: def.key,
                title: getRecordTitle(def, {
                  id: row.id,
                  values: row.values,
                  refs: {},
                }),
                subtitle: label(def.label, language),
              }))
        )
        const examples = db.examples.findMany(
          (item) => item.workspaceId === workspaceId
        )
        const exampleHits: SearchHit[] = applySearch(examples, q, ["name"]).map(
          (item) => ({
            id: item.id,
            type: "example",
            objectKey: null,
            title: item.name,
            subtitle: db.users.findById(item.ownerId)?.name ?? null,
          })
        )

        return HttpResponse.json({
          data: [...records, ...exampleHits].slice(0, MAX_HITS),
        })
      },
      { empty: () => HttpResponse.json({ data: [] }) }
    )
  ),
]
