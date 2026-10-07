import { CheckIcon, Loader2Icon, PencilIcon, XIcon } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { getFieldType } from "@/engine/field-types"
import {
  label,
  type CrmRecord,
  type FieldDef,
  type ObjectDef,
} from "@/engine/metadata"
import { metadataToZod } from "@/engine/records"
import { isApiError } from "@/lib/api"
import { getCurrentLanguage } from "@/lib/i18n"

import { useUpdateRecord } from "../api/records.mutations"

interface InlineFieldProps {
  objectDef: ObjectDef
  record: CrmRecord
  field: FieldDef
  canEdit: boolean
}

/**
 * One label/value row of the detail page. Editing saves optimistically: the
 * new value shows at once and rolls back if the server rejects it (B2.3).
 */
export function InlineField({
  objectDef,
  record,
  field,
  canEdit,
}: InlineFieldProps) {
  const { t } = useTranslation(["records", "errors"])
  const language = getCurrentLanguage()
  const id = useId()
  const definition = getFieldType(field.type)
  const mutation = useUpdateRecord(objectDef.key)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)
  const name = label(field.label, language)
  const value = record.values[field.key]
  const editable =
    canEdit && !field.readOnly && field.key !== objectDef.pipeline?.field

  function startEditing() {
    setDraft(value ?? null)
    setError(null)
    setEditing(true)
  }

  function save() {
    const parsed = metadataToZod(objectDef, { fields: [field.key] }).safeParse({
      [field.key]: draft,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t("errors:validation"))
      return
    }
    setEditing(false)
    mutation.mutate(
      { id: record.id, values: parsed.data },
      {
        onError: (failure) => {
          // 422s skip the global toast: show the field message instead.
          if (isApiError(failure) && failure.isValidationError) {
            const message =
              failure.fieldErrors?.[field.key]?.[0] ?? failure.message
            toast.error(t("inline.failed", { field: name }), {
              description: message,
            })
          }
        },
        onSuccess: () => toast.success(t("inline.saved", { field: name })),
      }
    )
  }

  return (
    <div className="group/field grid gap-1 py-2.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
      <dt
        id={`${id}-label`}
        className="text-sm text-muted-foreground sm:pt-1.5"
      >
        {name}
      </dt>
      <dd className="min-w-0 text-sm">
        {editing ? (
          <form
            className="flex flex-col gap-1.5"
            onSubmit={(event) => {
              event.preventDefault()
              save()
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation()
                setEditing(false)
              }
            }}
          >
            <div className="flex items-start gap-1.5">
              <div className="min-w-0 flex-1">
                <definition.Input
                  id={`${id}-input`}
                  labelId={`${id}-label`}
                  ariaLabel={name}
                  field={field}
                  value={draft}
                  onChange={(next) => {
                    setDraft(next)
                    setError(null)
                  }}
                  invalid={!!error}
                  describedBy={error ? `${id}-error` : undefined}
                  refValue={record.refs[field.key]}
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                size="icon-sm"
                aria-label={t("inline.save", { field: name })}
              >
                <CheckIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("inline.cancel")}
                onClick={() => setEditing(false)}
              >
                <XIcon />
              </Button>
            </div>
            {error ? (
              <p
                id={`${id}-error`}
                role="alert"
                className="text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}
          </form>
        ) : (
          <div className="flex min-h-8 items-center gap-2">
            <div className="min-w-0 flex-1">
              <definition.Cell
                field={field}
                value={value}
                refValue={record.refs[field.key]}
              />
            </div>
            {mutation.isPending ? (
              <span role="status" className="text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" aria-hidden />
                <span className="sr-only">{t("inline.saving")}</span>
              </span>
            ) : null}
            {editable ? (
              <Button
                variant="ghost"
                size="icon-sm"
                className="opacity-60 group-hover/field:opacity-100 focus-visible:opacity-100"
                aria-label={t("inline.edit", { field: name })}
                onClick={startEditing}
              >
                <PencilIcon />
              </Button>
            ) : null}
          </div>
        )}
      </dd>
    </div>
  )
}
