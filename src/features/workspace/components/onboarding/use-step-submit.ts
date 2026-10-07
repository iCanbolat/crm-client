import type { FieldValues, UseFormReturn } from "react-hook-form"

import { getErrorMessage } from "@/lib/api"
import { applyServerFieldErrors } from "@/lib/forms"

/**
 * Validates the step form, then hands the values to the wizard. API errors
 * land on the fields (422) or as a form-level message.
 */
export function useStepSubmit<T extends FieldValues>(
  form: UseFormReturn<T>,
  onSubmit: (values: T) => Promise<void>
) {
  return form.handleSubmit(async (values) => {
    try {
      await onSubmit(values)
    } catch (error) {
      if (applyServerFieldErrors(error, form.setError)) return
      form.setError("root.server", {
        type: "server",
        message: getErrorMessage(error),
      })
    }
  })
}
