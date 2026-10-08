import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"

import type { SubmissionStatus } from "../api/submissions.schemas"

const VARIANTS = {
  new: "default",
  processed: "secondary",
  spam: "outline",
  failed: "destructive",
} as const

export function SubmissionStatusBadge({
  status,
}: {
  status: SubmissionStatus
}) {
  const { t } = useTranslation("submissions")
  return <Badge variant={VARIANTS[status]}>{t(`status.${status}`)}</Badge>
}
