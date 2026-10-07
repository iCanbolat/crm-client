import { apiClient } from "@/lib/api"

import {
  invitesResponseSchema,
  inviteSchema,
  membersResponseSchema,
  workspaceSchema,
  type CompleteOnboardingInput,
  type InviteInput,
  type SaveOnboardingInput,
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
