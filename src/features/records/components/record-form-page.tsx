import { useBlocker } from "@tanstack/react-router"
import { Loader2Icon } from "lucide-react"
import { useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  getRecordTitle,
  label,
  type CrmRecord,
  type ObjectDef,
  type RecordValues,
} from "@/engine/metadata"
import { getCurrentLanguage } from "@/lib/i18n"

import { RecordForm } from "./record-form"

interface RecordFormPageProps {
  objectDef: ObjectDef
  record?: CrmRecord
  defaultValues?: RecordValues
  onSubmitted: (record: CrmRecord) => void
  onCancel: () => void
}

/**
 * Full page create/edit (`/o/$objectKey/new`, `…/$recordId/edit`).
 * Leaving with unsaved changes is blocked until the user confirms.
 */
export function RecordFormPage({
  objectDef,
  record,
  defaultValues,
  onSubmitted,
  onCancel,
}: RecordFormPageProps) {
  const { t } = useTranslation(["records", "common"])
  const language = getCurrentLanguage()
  const formId = useId()
  const [dirty, setDirty] = useState(false)
  const [pending, setPending] = useState(false)
  const submitted = useRef(false)

  const blocker = useBlocker({
    shouldBlockFn: () => dirty && !submitted.current,
    enableBeforeUnload: () => dirty && !submitted.current,
    withResolver: true,
  })

  const title = record
    ? t("form.editTitle", { title: getRecordTitle(objectDef, record) })
    : t("form.createTitle", { object: label(objectDef.label, language) })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        description={t("form.description")}
        actions={
          <>
            <Button variant="ghost" onClick={onCancel} disabled={pending}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" form={formId} disabled={pending}>
              {pending ? (
                <Loader2Icon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : null}
              {t("common:actions.save")}
            </Button>
          </>
        }
      />
      <Card>
        <CardContent className="pt-6">
          <RecordForm
            id={formId}
            objectDef={objectDef}
            record={record}
            defaultValues={defaultValues}
            onDirtyChange={setDirty}
            onPendingChange={setPending}
            onSubmitted={(saved) => {
              submitted.current = true
              onSubmitted(saved)
            }}
          />
        </CardContent>
      </Card>
      <ConfirmDialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          // Closing after "discard" must not cancel the navigation again.
          if (!open && !submitted.current) blocker.reset?.()
        }}
        title={t("form.unsavedTitle")}
        description={t("form.unsavedDescription")}
        confirmLabel={t("common:actions.discard")}
        cancelLabel={t("common:actions.keepEditing")}
        variant="destructive"
        onConfirm={() => {
          submitted.current = true
          blocker.proceed?.()
        }}
      />
    </div>
  )
}
