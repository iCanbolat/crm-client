import { useQueryErrorResetBoundary } from "@tanstack/react-query"
import { useRouter, type ErrorComponentProps } from "@tanstack/react-router"
import { useEffect } from "react"

import { ErrorState } from "@/components/common/error-state"
import { ForbiddenPage } from "@/components/common/forbidden"
import { isApiError } from "@/lib/api"
import { reportError } from "@/lib/error-reporting"
import { isForbiddenError } from "@/lib/rbac"

/** Route-level error boundary; retry resets failed queries and reruns loaders. */
export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter()
  const queryErrorResetBoundary = useQueryErrorResetBoundary()

  useEffect(() => {
    queryErrorResetBoundary.reset()
  }, [queryErrorResetBoundary])

  useEffect(() => {
    reportError(error, { source: "route" })
  }, [error])

  // Route guards and the API agree on 403: show the dedicated page.
  if (isForbiddenError(error) || (isApiError(error) && error.status === 403)) {
    return <ForbiddenPage />
  }

  return (
    <ErrorState
      error={error}
      onRetry={() => void router.invalidate()}
      className="my-6"
    />
  )
}
