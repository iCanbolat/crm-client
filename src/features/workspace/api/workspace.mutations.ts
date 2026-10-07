import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { authKeys } from "@/features/auth"

import {
  completeOnboarding,
  createInvite,
  saveOnboardingProgress,
} from "./workspace.api"
import { workspaceKeys } from "./workspace.keys"

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
