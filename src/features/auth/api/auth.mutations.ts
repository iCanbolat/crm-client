import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { signIn, signOut } from "../lib/session"
import { requestPasswordReset } from "./auth.api"
import type { LoginInput } from "./auth.schemas"

export function useLoginMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: LoginInput) => signIn(queryClient, input),
    // The login form renders its own error message.
    meta: { suppressErrorToast: true },
  })
}

/**
 * Signs out, leaves the protected area and only then empties the cache, so
 * no mounted screen refetches without a token on the way out.
 */
export function useSignOut() {
  const { t } = useTranslation("auth")
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: signOut,
    meta: { successMessage: t("logout.done") },
    onSettled: async () => {
      await navigate({ to: "/login" })
      queryClient.clear()
    },
  })

  return { signOut: () => mutation.mutate(), isPending: mutation.isPending }
}

export function useForgotPasswordMutation() {
  return useMutation({ mutationFn: requestPasswordReset })
}
