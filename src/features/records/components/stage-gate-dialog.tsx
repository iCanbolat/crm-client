import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon } from "lucide-react"
import { useId, useMemo } from "react"
import { Controller, useForm, type Resolver } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { getFieldType } from "@/engine/field-types"
import {
  getStage,
  label,
  type FieldDef,
  type ObjectDef,
  type RecordValues,
} from "@/engine/metadata"
import { metadataToZod } from "@/engine/records"
import { getCurrentLanguage } from "@/lib/i18n"

export interface StageGateRequest {
  recordTitle: string
  stage: string
  fields: FieldDef[]
}

interface StageGateDialogProps {
  objectDef: ObjectDef
  request: StageGateRequest | null
  isPending?: boolean
  onConfirm: (values: RecordValues) => void | Promise<void>
  onCancel: () => void
}

function GateForm({
  objectDef,
  request,
  isPending,
  onConfirm,
  onCancel,
}: StageGateDialogProps & { request: StageGateRequest }) {
  const { t } = useTranslation(["records", "common"])
  const language = getCurrentLanguage()
  const formId = useId()
  const schema = useMemo(
    () =>
      metadataToZod(
        {
          ...objectDef,
          // The gate makes these fields mandatory for this move.
          fields: request.fields.map((field) => ({ ...field, required: true })),
        },
        { fields: request.fields.map((field) => field.key) }
      ),
    [objectDef, request.fields]
  )
  const form = useForm<RecordValues>({
    resolver: zodResolver(schema) as Resolver<RecordValues>,
    defaultValues: Object.fromEntries(
      request.fields.map((field) => [field.key, null])
    ),
  })
  const stage = getStage(objectDef, request.stage)

  return (
    <form
      id={formId}
      noValidate
      className="flex flex-col gap-6"
      onSubmit={form.handleSubmit((values) => onConfirm(values))}
    >
      <DialogHeader>
        <DialogTitle>
          {t("stage.gateTitle", {
            stage: stage ? label(stage.label, language) : request.stage,
          })}
        </DialogTitle>
        <DialogDescription>
          {t("stage.gateDescription", { title: request.recordTitle })}
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        {request.fields.map((field) => {
          const Input = getFieldType(field.type).Input
          const inputId = `${formId}-${field.key}`
          return (
            <Controller
              key={field.key}
              name={field.key}
              control={form.control}
              render={({ field: controller, fieldState }) => (
                <Field data-invalid={fieldState.error ? true : undefined}>
                  <FieldLabel htmlFor={inputId} id={`${inputId}-label`}>
                    {label(field.label, language)}
                  </FieldLabel>
                  <Input
                    id={inputId}
                    labelId={`${inputId}-label`}
                    field={{ ...field, required: true }}
                    value={controller.value}
                    onChange={controller.onChange}
                    onBlur={controller.onBlur}
                    invalid={!!fieldState.error}
                    describedBy={
                      fieldState.error ? `${inputId}-error` : undefined
                    }
                    autoFocus
                  />
                  <FieldError
                    id={`${inputId}-error`}
                    errors={[fieldState.error]}
                  />
                </Field>
              )}
            />
          )
        })}
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("common:actions.cancel")}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <Loader2Icon className="animate-spin" data-icon="inline-start" />
          ) : null}
          {t("stage.gateConfirm")}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Stage gate: asks for the fields a stage requires before moving (B2.5). */
export function StageGateDialog(props: StageGateDialogProps) {
  return (
    <Dialog
      open={props.request !== null}
      onOpenChange={(open) => {
        if (!open) props.onCancel()
      }}
    >
      <DialogContent>
        {props.request ? <GateForm {...props} request={props.request} /> : null}
      </DialogContent>
    </Dialog>
  )
}
