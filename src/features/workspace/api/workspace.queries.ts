import { queryOptions } from "@tanstack/react-query"

import { fetchInvites, fetchMembers, fetchWorkspace } from "./workspace.api"
import { workspaceKeys } from "./workspace.keys"

export const workspaceQueries = {
  current: () =>
    queryOptions({
      queryKey: workspaceKeys.current(),
      queryFn: ({ signal }) => fetchWorkspace(signal),
    }),
  members: () =>
    queryOptions({
      queryKey: workspaceKeys.members(),
      queryFn: ({ signal }) => fetchMembers(signal),
    }),
  invites: () =>
    queryOptions({
      queryKey: workspaceKeys.invites(),
      queryFn: ({ signal }) => fetchInvites(signal),
    }),
}
