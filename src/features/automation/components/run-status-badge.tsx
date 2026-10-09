import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"

import type { RunStatus } from "../api/automation.schemas"

const VARIANTS = {
  success: "secondary",
  skipped: "outline",
  failed: "destructive",
} as const

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const { t } = useTranslation("automation")
  return (
    <Badge variant={VARIANTS[status]}>{t(`runs.statuses.${status}`)}</Badge>
  )
}
