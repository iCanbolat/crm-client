import type { FieldValues, Path, UseFormSetError } from "react-hook-form"

import { isApiError } from "@/lib/api"

/**
 * Maps `fieldErrors` of a 422 API response onto react-hook-form fields.
 * Returns `true` when at least one field error was applied.
 */
export function applyServerFieldErrors<TFieldValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TFieldValues>
): boolean {
  if (!isApiError(error) || !error.fieldErrors) return false

  const entries = Object.entries(error.fieldErrors).filter(
    ([, messages]) => messages.length > 0
  )

  entries.forEach(([field, messages], index) => {
    setError(
      field as Path<TFieldValues>,
      { type: "server", message: messages[0] },
      { shouldFocus: index === 0 }
    )
  })

  return entries.length > 0
}
