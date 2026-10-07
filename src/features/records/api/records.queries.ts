import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import {
  fetchAttachments,
  fetchObjects,
  fetchRecord,
  fetchRecords,
  fetchUserDirectory,
  fetchViews,
} from "./records.api"
import {
  directoryKeys,
  metadataKeys,
  recordKeys,
  viewKeys,
} from "./records.keys"
import type { RecordListParams } from "./records.schemas"

/*
 * Queries that route loaders await *and* long-lived components observe
 * (shell, breadcrumbs, field services) do not pass the AbortSignal: when a
 * transient observer unmounts, TanStack Query cancels signal-aware fetches,
 * which would reject the loader's `ensureQueryData` with a CancelledError.
 */

export const metadataQueries = {
  /** Object definitions of the workspace (app configuration, rarely changes). */
  objects: () =>
    queryOptions({
      queryKey: metadataKeys.objects(),
      queryFn: () => fetchObjects(),
      staleTime: 5 * 60_000,
    }),
}

export const recordQueries = {
  list: (objectKey: string, params: RecordListParams) =>
    queryOptions({
      queryKey: recordKeys.list(objectKey, params),
      queryFn: ({ signal }) => fetchRecords(objectKey, params, signal),
      placeholderData: keepPreviousData,
    }),
  detail: (objectKey: string, id: string) =>
    queryOptions({
      queryKey: recordKeys.detail(objectKey, id),
      queryFn: () => fetchRecord(objectKey, id),
    }),
  attachments: (objectKey: string, id: string) =>
    queryOptions({
      queryKey: recordKeys.attachments(objectKey, id),
      queryFn: ({ signal }) => fetchAttachments(objectKey, id, signal),
    }),
}

export const viewQueries = {
  list: (objectKey: string) =>
    queryOptions({
      queryKey: viewKeys.list(objectKey),
      queryFn: () => fetchViews(objectKey),
    }),
}

export const directoryQueries = {
  users: () =>
    queryOptions({
      queryKey: directoryKeys.users(),
      queryFn: () => fetchUserDirectory(),
      staleTime: 5 * 60_000,
    }),
}
