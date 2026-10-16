import { apiClient } from "@/lib/api"

import { authTokensSchema } from "@/features/auth"

import {
  acceptInviteResponseSchema,
  invitationSchema,
  invitesResponseSchema,
  inviteSchema,
  membersResponseSchema,
  workspaceSchema,
  type CompleteOnboardingInput,
  type CreateWorkspaceInput,
  type InviteInput,
  type InviteSignUpInput,
  type MemberRoleInput,
  type SaveOnboardingInput,
  type WorkspaceSettingsInput,
} from "./workspace.schemas"

export function fetchWorkspace(signal?: AbortSignal) {
  return apiClient.get("/workspace", { signal, schema: workspaceSchema })
}

export function saveOnboardingProgress(input: SaveOnboardingInput) {
  return apiClient.put("/workspace/onboarding", {
    body: input,
    schema: workspaceSchema,
  })
}

export function completeOnboarding(input: CompleteOnboardingInput) {
  return apiClient.post("/workspace/onboarding", {
    body: input,
    schema: workspaceSchema,
  })
}

/** Creates a workspace owned by the user; it starts with its onboarding. */
export function createWorkspace(input: CreateWorkspaceInput) {
  return apiClient.post("/workspaces", { body: input, schema: workspaceSchema })
}

export function updateWorkspaceSettings(input: WorkspaceSettingsInput) {
  return apiClient.patch("/workspace/settings", {
    body: input,
    schema: workspaceSchema,
  })
}

export function activateModule(moduleId: string) {
  return apiClient.post(
    `/workspace/modules/${encodeURIComponent(moduleId)}/activate`,
    { schema: workspaceSchema }
  )
}

export function fetchMembers(signal?: AbortSignal) {
  return apiClient.get("/workspace/members", {
    signal,
    schema: membersResponseSchema,
  })
}

export function fetchInvites(signal?: AbortSignal) {
  return apiClient.get("/workspace/invites", {
    signal,
    schema: invitesResponseSchema,
  })
}

export function createInvite(input: InviteInput) {
  return apiClient.post("/workspace/invites", {
    body: input,
    schema: inviteSchema,
  })
}

export function updateMemberRole(userId: string, input: MemberRoleInput) {
  return apiClient.patch(`/workspace/members/${encodeURIComponent(userId)}`, {
    body: input,
  })
}

export function removeMember(userId: string) {
  return apiClient.delete(`/workspace/members/${encodeURIComponent(userId)}`)
}

export function revokeInvite(id: string) {
  return apiClient.delete(`/workspace/invites/${encodeURIComponent(id)}`)
}

export function resendInvite(id: string) {
  return apiClient.post(`/workspace/invites/${encodeURIComponent(id)}/resend`, {
    schema: inviteSchema,
  })
}

/* Invitation links (`/invite/:token`, Faz 10) */

const invitePath = (token: string) => `/invites/${encodeURIComponent(token)}`

export function fetchInvitation(token: string, signal?: AbortSignal) {
  return apiClient.get(invitePath(token), {
    signal,
    schema: invitationSchema,
    auth: false,
  })
}

export function acceptInvite(token: string) {
  return apiClient.post(`${invitePath(token)}/accept`, {
    schema: acceptInviteResponseSchema,
  })
}

export function signUpWithInvite(token: string, input: InviteSignUpInput) {
  return apiClient.post(`${invitePath(token)}/register`, {
    body: input,
    schema: authTokensSchema.extend(acceptInviteResponseSchema.shape),
    auth: false,
  })
}
