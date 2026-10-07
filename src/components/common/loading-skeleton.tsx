import { useTranslation } from "react-i18next"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface LoadingSkeletonProps {
  variant?: "list" | "card" | "page"
  rows?: number
  className?: string
}

export function LoadingSkeleton({
  variant = "list",
  rows = 5,
  className,
}: LoadingSkeletonProps) {
  const { t } = useTranslation()

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={t("loading")}
      className={cn("flex flex-col gap-4", className)}
    >
      {variant === "page" ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
      ) : null}
      {variant === "card" ? (
        <Skeleton className="h-40 w-full rounded-3xl" />
      ) : (
        <div className="flex flex-col gap-2">
          {Array.from({ length: rows }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-2xl" />
          ))}
        </div>
      )}
    </div>
  )
}
