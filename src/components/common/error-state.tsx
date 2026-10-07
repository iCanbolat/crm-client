import { CircleAlertIcon, RotateCwIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { getErrorMessage } from "@/lib/api"
import { cn } from "@/lib/utils"

interface ErrorStateProps {
  error?: unknown
  title?: ReactNode
  description?: ReactNode
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  error,
  title,
  description,
  onRetry,
  className,
}: ErrorStateProps) {
  const { t } = useTranslation(["common", "errors"])

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-3xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center",
        className
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <CircleAlertIcon className="size-6" aria-hidden />
      </div>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="font-medium">{title ?? t("errors:title")}</p>
        <p className="text-sm text-muted-foreground">
          {description ?? getErrorMessage(error)}
        </p>
      </div>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          <RotateCwIcon data-icon="inline-start" />
          {t("actions.retry")}
        </Button>
      ) : null}
    </div>
  )
}
