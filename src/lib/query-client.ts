import {
  MutationCache,
  QueryCache,
  QueryClient,
  type DefaultOptions,
} from "@tanstack/react-query"
import { toast } from "sonner"

import { getErrorMessage, isApiError } from "@/lib/api"
import { reportError } from "@/lib/error-reporting"

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /** Skip the global error toast (e.g. the caller renders the error itself). */
      suppressErrorToast?: boolean
      /** Shown as a success toast once the mutation resolves. */
      successMessage?: string
    }
  }
}

const MAX_RETRIES = 2

export function shouldRetryQuery(failureCount: number, error: unknown) {
  if (isApiError(error)) {
    // 4xx and contract violations will not fix themselves on retry.
    if (error.kind === "invalid_response") return false
    if (error.status >= 400 && error.status < 500) return false
  }
  return failureCount < MAX_RETRIES
}

export function createQueryClient(overrides: DefaultOptions = {}) {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) =>
        reportError(error, {
          source: "query",
          tags: { queryKey: JSON.stringify(query.queryKey) },
        }),
    }),
    mutationCache: new MutationCache({
      onSuccess: (_data, _variables, _context, mutation) => {
        const message = mutation.meta?.successMessage
        if (message) toast.success(message)
      },
      onError: (error, _variables, _context, mutation) => {
        reportError(error, {
          source: "mutation",
          tags: {
            mutationKey: JSON.stringify(mutation.options.mutationKey ?? []),
          },
        })
        if (mutation.meta?.suppressErrorToast) return
        // Field-level validation errors are rendered by the form itself.
        if (isApiError(error) && error.isValidationError) return
        toast.error(getErrorMessage(error))
      },
    }),
    defaultOptions: {
      ...overrides,
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetryQuery,
        refetchOnWindowFocus: false,
        ...overrides.queries,
      },
      mutations: {
        retry: false,
        ...overrides.mutations,
      },
    },
  })
}
