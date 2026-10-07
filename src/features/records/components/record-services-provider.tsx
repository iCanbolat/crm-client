import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, type ReactNode } from "react"

import { FieldServicesProvider, type FieldServices } from "@/engine/field-types"
import { getRecordTitle } from "@/engine/metadata"
import { usePermission } from "@/features/auth"
import { useWorkspace } from "@/features/workspace"

import { createRecord, fetchRecords, uploadFile } from "../api/records.api"
import { recordKeys } from "../api/records.keys"
import { directoryQueries } from "../api/records.queries"
import { ensureObjectDef } from "../hooks/use-object-def"

const SEARCH_PAGE_SIZE = 10

/**
 * Implements the engine's field services (user list, relation search,
 * "create new", uploads) on top of the records API.
 */
export function RecordServicesProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const workspace = useWorkspace()
  const canCreate = usePermission("create", "record")
  const { data: directory } = useQuery(directoryQueries.users())

  const services = useMemo<FieldServices>(
    () => ({
      users: (directory?.data ?? []).map((user) => ({
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
      })),
      defaultCurrency: workspace.currency ?? "TRY",
      defaultCountry: workspace.country ?? "TR",
      async searchRecords(objectKey, q, signal) {
        const def = await ensureObjectDef(queryClient, objectKey)
        if (!def) return []
        const page = await fetchRecords(
          objectKey,
          { page: 1, pageSize: SEARCH_PAGE_SIZE, q: q || undefined },
          signal
        )
        return page.data.map((record) => ({
          id: record.id,
          objectKey,
          label: getRecordTitle(def, record),
        }))
      },
      createRecord: canCreate
        ? async (objectKey, label) => {
            const def = await ensureObjectDef(queryClient, objectKey)
            if (!def) throw new Error(`Unknown object "${objectKey}"`)
            const record = await createRecord(objectKey, {
              [def.primaryField]: label,
            })
            queryClient.setQueryData(
              recordKeys.detail(objectKey, record.id),
              record
            )
            void queryClient.invalidateQueries({
              queryKey: recordKeys.lists(objectKey),
            })
            return {
              id: record.id,
              objectKey,
              label: getRecordTitle(def, record),
            }
          }
        : undefined,
      uploadFile,
    }),
    [directory, workspace.currency, workspace.country, canCreate, queryClient]
  )

  return (
    <FieldServicesProvider value={services}>{children}</FieldServicesProvider>
  )
}
