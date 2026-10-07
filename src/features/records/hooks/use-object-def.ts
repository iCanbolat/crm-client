import {
  useQuery,
  useSuspenseQuery,
  type QueryClient,
} from "@tanstack/react-query"

import type { ObjectDef } from "@/engine/metadata"

import { metadataQueries } from "../api/records.queries"

export function useObjectDefs() {
  return useSuspenseQuery(metadataQueries.objects()).data.data
}

/** Definition of one object; `undefined` when the workspace has no such object. */
export function useObjectDef(objectKey: string): ObjectDef | undefined {
  return useObjectDefs().find((def) => def.key === objectKey)
}

/** Same as `useObjectDef`, but never suspends (shell, breadcrumbs). */
export function useOptionalObjectDef(objectKey: string | undefined) {
  const { data } = useQuery(metadataQueries.objects())
  return objectKey ? data?.data.find((def) => def.key === objectKey) : undefined
}

/** Loader helper: resolves the definition (or `undefined`) via the cache. */
export async function ensureObjectDef(
  queryClient: QueryClient,
  objectKey: string
) {
  const { data } = await queryClient.ensureQueryData(metadataQueries.objects())
  return data.find((def) => def.key === objectKey)
}
