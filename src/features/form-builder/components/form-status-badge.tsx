import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"

import type { FormSummary } from "../api/forms.schemas"

/** "Yayında" / "Taslak" (+ unpublished draft changes). */
export function FormStatusBadge({
  form,
}: {
  form: Pick<FormSummary, "status" | "hasUnpublishedChanges">
}) {
  const { t } = useTranslation("forms")
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge variant={form.status === "published" ? "default" : "secondary"}>
        {t(`status.${form.status}`)}
      </Badge>
      {form.status === "published" && form.hasUnpublishedChanges ? (
        <Badge variant="outline">{t("unpublishedChanges")}</Badge>
      ) : null}
    </span>
  )
}
