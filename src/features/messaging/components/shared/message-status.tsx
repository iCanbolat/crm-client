import {
  AlertCircleIcon,
  CheckCheckIcon,
  CheckIcon,
  ClockIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"

import type { MessageStatus } from "@/engine/messaging"
import { cn } from "@/lib/utils"

const ICONS = {
  queued: ClockIcon,
  sent: CheckIcon,
  delivered: CheckCheckIcon,
  read: CheckCheckIcon,
  failed: AlertCircleIcon,
} as const

/** WhatsApp-style ticks with an accessible name. */
export function MessageStatusIcon({ status }: { status: MessageStatus }) {
  const { t } = useTranslation("messaging")
  const Icon = ICONS[status]
  return (
    <Icon
      role="img"
      aria-label={t(`status.${status}`)}
      className={cn(
        "size-3.5 shrink-0",
        status === "read" && "text-sky-700 dark:text-sky-400",
        status === "failed" && "text-destructive"
      )}
    />
  )
}
