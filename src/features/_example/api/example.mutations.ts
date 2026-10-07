import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { createExample, deleteExample } from "./example.api"
import { exampleKeys } from "./example.keys"

export function useCreateExample() {
  const { t } = useTranslation("example")
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createExample,
    meta: { successMessage: t("created") },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: exampleKeys.lists() }),
  })
}

export function useDeleteExample() {
  const { t } = useTranslation("example")
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteExample,
    meta: { successMessage: t("deleted") },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: exampleKeys.lists() }),
  })
}
