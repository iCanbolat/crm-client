import { useSuspenseQuery } from "@tanstack/react-query"

import { getActiveModules } from "@/engine/modules"

import { workspaceQueries } from "../api/workspace.queries"

export function useWorkspace() {
  return useSuspenseQuery(workspaceQueries.current()).data
}

/** Released module manifests activated for the current workspace. */
export function useActiveModules() {
  const workspace = useWorkspace()
  return getActiveModules(workspace.modules)
}
