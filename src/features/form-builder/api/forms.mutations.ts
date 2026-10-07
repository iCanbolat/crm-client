import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { createForm, deleteForm, updateForm } from "./forms.api"
import { formKeys } from "./forms.keys"
import type { Form, UpdateFormInput } from "./forms.schemas"

export function useCreateForm() {
  const { t } = useTranslation("forms")
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createForm,
    meta: { successMessage: t("toast.created") },
    onSuccess: (form) => {
      queryClient.setQueryData(formKeys.detail(form.id), form)
      return queryClient.invalidateQueries({ queryKey: formKeys.lists() })
    },
  })
}

/**
 * Draft autosave (B4.2). The builder owns the draft while open, so the
 * detail cache is only overwritten (never refetched under it); failures are
 * shown by the save indicator instead of a toast.
 */
export function useUpdateForm(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateFormInput) => updateForm(id, input),
    meta: { suppressErrorToast: true },
    onSuccess: (form: Form) => {
      queryClient.setQueryData(formKeys.detail(id), form)
      return queryClient.invalidateQueries({ queryKey: formKeys.lists() })
    },
  })
}

export function useDeleteForm() {
  const { t } = useTranslation("forms")
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteForm,
    meta: { successMessage: t("toast.deleted") },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: formKeys.detail(id) })
      return queryClient.invalidateQueries({ queryKey: formKeys.lists() })
    },
  })
}
