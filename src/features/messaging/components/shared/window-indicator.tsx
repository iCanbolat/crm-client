import { ClockIcon, LockIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { isWindowOpen, windowClosesAt } from "@/engine/messaging"
import { cn } from "@/lib/utils"

import { splitDuration } from "../../lib/conversation"

/** Re-renders every minute so the countdown stays honest. */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}

export function useWindowState(lastInboundAt: string | null) {
  const now = useNow()
  const open = isWindowOpen(lastInboundAt, now)
  const closesAt = windowClosesAt(lastInboundAt)
  return {
    open,
    never: !lastInboundAt,
    remaining: closesAt ? closesAt.getTime() - now.getTime() : 0,
  }
}

/** 24 h customer service window (B6.3). */
export function WindowIndicator({
  lastInboundAt,
  className,
}: {
  lastInboundAt: string | null
  className?: string
}) {
  const { t } = useTranslation("messaging")
  const { open, never, remaining } = useWindowState(lastInboundAt)
  const Icon = open ? ClockIcon : LockIcon
  return (
    <p
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-xl px-3 py-2 text-xs",
        open
          ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
          : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
        className
      )}
    >
      <Icon aria-hidden className="mt-px size-3.5 shrink-0" />
      {open
        ? t("window.open", splitDuration(remaining))
        : never
          ? t("window.never")
          : t("window.closed")}
    </p>
  )
}
