import { Loader2Icon } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  getRecordTitle,
  label,
  type CrmRecord,
  type ObjectDef,
  type RecordRef,
  type RecordValues,
} from "@/engine/metadata"
import { getCurrentLanguage } from "@/lib/i18n"

import { RecordForm } from "./record-form"

interface RecordFormSheetProps {
  objectDef: ObjectDef
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Edit mode when given. */
  record?: CrmRecord
  defaultValues?: RecordValues
  defaultRefs?: Record<string, RecordRef>
  onSubmitted?: (record: CrmRecord) => void
}

/** Create/edit in a side sheet; closing with unsaved changes asks first. */
export function RecordFormSheet({
  objectDef,
  open,
  onOpenChange,
  record,
  defaultValues,
  defaultRefs,
  onSubmitted,
}: RecordFormSheetProps) {
  const { t } = useTranslation(["records", "common"])
  const language = getCurrentLanguage()
  const formId = useId()
  const [dirty, setDirty] = useState(false)
  const [pending, setPending] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const singular = label(objectDef.label, language)

  function close() {
    setDirty(false)
    onOpenChange(false)
  }

  function requestClose() {
    if (pending) return
    if (dirty) setConfirmClose(true)
    else close()
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}
      >
        <SheetContent className="w-full gap-0 sm:max-w-xl">
          <SheetHeader className="border-b">
            <SheetTitle>
              {record
                ? t("form.editTitle", {
                    title: getRecordTitle(objectDef, record),
                  })
                : t("form.createTitle", { object: singular })}
            </SheetTitle>
            <SheetDescription>{t("form.description")}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-6">
            {open ? (
              <RecordForm
                id={formId}
                objectDef={objectDef}
                record={record}
                defaultValues={defaultValues}
                defaultRefs={defaultRefs}
                onDirtyChange={setDirty}
                onPendingChange={setPending}
                onSubmitted={(saved) => {
                  close()
                  onSubmitted?.(saved)
                }}
              />
            ) : null}
          </div>
          <SheetFooter className="flex-row justify-end border-t">
            <Button variant="ghost" onClick={requestClose} disabled={pending}>
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
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title={t("form.unsavedTitle")}
        description={t("form.unsavedDescription")}
        confirmLabel={t("common:actions.discard")}
        cancelLabel={t("common:actions.keepEditing")}
        variant="destructive"
        onConfirm={close}
      />
    </>
  )
}
