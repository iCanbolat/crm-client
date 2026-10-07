import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useMemo } from "react"
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { getFieldType } from "@/engine/field-types"
import {
  getFormSections,
  label,
  type CrmRecord,
  type FieldDef,
  type ObjectDef,
  type RecordRef,
  type RecordValues,
} from "@/engine/metadata"
import {
  clearHiddenFields,
  isFieldVisible,
  metadataToZod,
} from "@/engine/records"
import { useSession } from "@/features/auth"
import { isApiError } from "@/lib/api"
import { applyServerFieldErrors } from "@/lib/forms"
import { getCurrentLanguage, type Language } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { useCreateRecord, useUpdateRecord } from "../api/records.mutations"

type FormValues = Record<string, unknown>

export interface RecordFormProps {
  /** `id` of the `<form>`; external submit buttons use `form={id}`. */
  id: string
  objectDef: ObjectDef
  /** Edit mode when given. */
  record?: CrmRecord
  /** Prefilled values of a new record (e.g. the parent of a related list). */
  defaultValues?: RecordValues
  /** Labels of prefilled relation values. */
  defaultRefs?: Record<string, RecordRef>
  onSubmitted: (record: CrmRecord) => void
  onDirtyChange?: (dirty: boolean) => void
  onPendingChange?: (pending: boolean) => void
}

export const fieldInputId = (formId: string, key: string) => `${formId}-${key}`

/** Inputs that need the full row (multi-line, repeating rows). */
const WIDE_TYPES = new Set(["textarea", "file", "container", "dimensions"])

function buildDefaults(
  objectDef: ObjectDef,
  fields: FieldDef[],
  record: CrmRecord | undefined,
  prefill: RecordValues | undefined,
  currentUserId: string
): FormValues {
  const defaults: FormValues = {}
  for (const field of fields) {
    defaults[field.key] =
      record?.values[field.key] ?? prefill?.[field.key] ?? null
  }
  if (!record) {
    if ("ownerId" in defaults && defaults.ownerId === null) {
      defaults.ownerId = currentUserId
    }
    const pipeline = objectDef.pipeline
    if (pipeline && defaults[pipeline.field] === null) {
      defaults[pipeline.field] = pipeline.stages[0]?.key ?? null
    }
  }
  return defaults
}

function FieldRow({
  formId,
  field,
  language,
  control,
  refValue,
}: {
  formId: string
  field: FieldDef
  language: Language
  control: ReturnType<typeof useForm<FormValues>>["control"]
  refValue?: RecordRef | null
}) {
  const { t } = useTranslation("records")
  const definition = getFieldType(field.type)
  const inputId = fieldInputId(formId, field.key)
  const labelId = `${inputId}-label`
  const errorId = `${inputId}-error`
  const helpId = `${inputId}-help`
  const wide = WIDE_TYPES.has(field.type)

  return (
    <Controller
      name={field.key}
      control={control}
      render={({ field: controller, fieldState }) => (
        <Field
          data-invalid={fieldState.error ? true : undefined}
          className={cn(wide && "sm:col-span-2")}
        >
          <FieldLabel htmlFor={inputId} id={labelId}>
            {label(field.label, language)}
            {field.required ? (
              <>
                <span aria-hidden className="text-destructive">
                  *
                </span>
                <span className="sr-only">{t("form.required")}</span>
              </>
            ) : null}
          </FieldLabel>
          <definition.Input
            id={inputId}
            labelId={labelId}
            field={field}
            value={controller.value}
            onChange={controller.onChange}
            onBlur={controller.onBlur}
            invalid={!!fieldState.error}
            describedBy={
              [
                fieldState.error ? errorId : null,
                field.helpText ? helpId : null,
              ]
                .filter(Boolean)
                .join(" ") || undefined
            }
            refValue={refValue}
          />
          {field.helpText ? (
            <FieldDescription id={helpId}>
              {label(field.helpText, language)}
            </FieldDescription>
          ) : null}
          <FieldError id={errorId} errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

/** Create / edit form generated from metadata (B2.4). */
export function RecordForm({
  id,
  objectDef,
  record,
  defaultValues,
  defaultRefs,
  onSubmitted,
  onDirtyChange,
  onPendingChange,
}: RecordFormProps) {
  const { t } = useTranslation("records")
  const language = getCurrentLanguage()
  const { user } = useSession()
  const sections = useMemo(() => getFormSections(objectDef), [objectDef])
  const fields = useMemo(
    () => sections.flatMap((section) => section.fields),
    [sections]
  )
  const schema = useMemo(() => metadataToZod(objectDef), [objectDef])
  const createMutation = useCreateRecord(objectDef.key)
  const updateMutation = useUpdateRecord(objectDef.key, {
    optimistic: false,
    successMessage: t("toast.updated"),
  })
  const pending = createMutation.isPending || updateMutation.isPending

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: buildDefaults(
      objectDef,
      fields,
      record,
      defaultValues,
      user.id
    ),
    shouldFocusError: false,
  })
  const { isDirty } = form.formState
  // Conditional fields (B3.3) follow the values being typed.
  const watched = useWatch({ control: form.control }) as FormValues
  const visible = (field: FieldDef) => isFieldVisible(objectDef, field, watched)

  useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange])
  useEffect(() => onPendingChange?.(pending), [pending, onPendingChange])

  function focusFirstError(keys: string[]) {
    const first = fields.find((field) => keys.includes(field.key))
    if (first) document.getElementById(fieldInputId(id, first.key))?.focus()
  }

  const onSubmit = form.handleSubmit(
    async (input) => {
      // Hidden conditional fields are cleared, never submitted stale.
      const values = clearHiddenFields(objectDef, input)
      try {
        const saved = record
          ? await updateMutation.mutateAsync({ id: record.id, values })
          : await createMutation.mutateAsync(values)
        form.reset(values)
        onSubmitted(saved)
      } catch (error) {
        if (applyServerFieldErrors(error, form.setError) && isApiError(error)) {
          focusFirstError(Object.keys(error.fieldErrors ?? {}))
        }
      }
    },
    (errors) => focusFirstError(Object.keys(errors))
  )

  return (
    <form
      id={id}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-8"
    >
      {sections.map((section) => {
        const shown = section.fields.filter(visible)
        if (shown.length === 0) return null
        return (
          <FieldSet key={section.key}>
            {section.label ? (
              <FieldLegend>{label(section.label, language)}</FieldLegend>
            ) : null}
            <div className="grid gap-5 sm:grid-cols-2">
              {shown.map((field) => (
                <FieldRow
                  key={field.key}
                  formId={id}
                  field={field}
                  language={language}
                  control={form.control}
                  refValue={record?.refs[field.key] ?? defaultRefs?.[field.key]}
                />
              ))}
            </div>
          </FieldSet>
        )
      })}
    </form>
  )
}
