import { queryOptions } from "@tanstack/react-query"

import {
  fetchInvitation,
  fetchInvites,
  fetchMembers,
  fetchWorkspace,
} from "./workspace.api"
import { invitationKeys, workspaceKeys } from "./workspace.keys"

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
  invitation: (token: string) =>
    queryOptions({
      queryKey: invitationKeys.detail(token),
      queryFn: ({ signal }) => fetchInvitation(token, signal),
      retry: false,
    }),
}
