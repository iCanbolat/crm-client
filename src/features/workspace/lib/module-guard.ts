import type { QueryClient } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"

import { isModuleActive } from "@/engine/modules"

import { workspaceQueries } from "../api/workspace.queries"

/**
 * `beforeLoad` guard of module screens (e.g. the quote builder): a module
 * the workspace does not use has no such page (404, TC-3.1-03).
 */
export async function ensureModuleActive(
  queryClient: QueryClient,
  moduleId: string
) {
  const workspace = await queryClient.ensureQueryData(
    workspaceQueries.current()
  )
  if (!isModuleActive(moduleId, workspace.modules)) throw notFound()
}
