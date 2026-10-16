import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { authKeys } from "@/features/auth"

import {
  completeOnboarding,
  createInvite,
  createWorkspace,
  removeMember,
  resendInvite,
  revokeInvite,
  saveOnboardingProgress,
  updateMemberRole,
  updateWorkspaceSettings,
} from "./workspace.api"
import { workspaceKeys } from "./workspace.keys"
import type { MemberRoleInput } from "./workspace.schemas"

export function useSaveOnboardingProgress() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: saveOnboardingProgress,
    onSuccess: (workspace) =>
      queryClient.setQueryData(workspaceKeys.current(), workspace),
  })
}

export function useCompleteOnboarding() {
  const { t } = useTranslation("workspace")
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: completeOnboarding,
    meta: {
      successMessage: t("onboarding.completed"),
      suppressErrorToast: true,
    },
    onSuccess: async (workspace) => {
      queryClient.setQueryData(workspaceKeys.current(), workspace)
      // The workspace name/logo shown in memberships may have changed.
      await queryClient.invalidateQueries({ queryKey: authKeys.me() })
    },
  })
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createWorkspace,
    // The new membership must show up in the switcher.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.me() }),
  })
}

export function useUpdateWorkspaceSettings() {
  const { t } = useTranslation("workspace")
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateWorkspaceSettings,
    meta: { successMessage: t("visibility.saved") },
    onSuccess: async (workspace) => {
      queryClient.setQueryData(workspaceKeys.current(), workspace)
      // Lists, boards and dashboards now show another set of records.
      await queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== "auth",
      })
    },
  })
}

export function useCreateInvite() {
  const { t } = useTranslation("workspace")
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createInvite,
    meta: { successMessage: t("members.inviteSent") },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: workspaceKeys.invites() }),
  })
}

/* Team management (Faz 10) */

function useInvalidateTeam() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: workspaceKeys.members() }),
      queryClient.invalidateQueries({ queryKey: workspaceKeys.invites() }),
    ])
}

export function useUpdateMemberRole() {
  const { t } = useTranslation("workspace")
  const invalidate = useInvalidateTeam()

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string } & MemberRoleInput) =>
      updateMemberRole(userId, { role }),
    meta: { successMessage: t("members.roleChanged") },
    onSuccess: invalidate,
  })
}

export function useRemoveMember() {
  const { t } = useTranslation("workspace")
  const invalidate = useInvalidateTeam()

  return useMutation({
    mutationFn: removeMember,
    meta: { successMessage: t("members.removed") },
    onSuccess: invalidate,
  })
}

export function useRevokeInvite() {
  const { t } = useTranslation("workspace")
  const invalidate = useInvalidateTeam()

  return useMutation({
    mutationFn: revokeInvite,
    meta: { successMessage: t("members.inviteRevoked") },
    onSuccess: invalidate,
  })
}

export function useResendInvite() {
  const { t } = useTranslation("workspace")
  const invalidate = useInvalidateTeam()

  return useMutation({
    mutationFn: resendInvite,
    meta: { successMessage: t("members.inviteResent") },
    onSuccess: invalidate,
  })
}
