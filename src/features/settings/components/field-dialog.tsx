import { Loader2Icon } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getFieldTypes } from "@/engine/field-types"
import {
  FIELD_KEY_PATTERN,
  getStageField,
  label,
  type FieldDef,
  type ObjectDef,
} from "@/engine/metadata"
import {
  useCreateField,
  useObjectDefs,
  useUpdateField,
  type FieldInput,
  type FieldPatch,
} from "@/features/records"
import { isApiError } from "@/lib/api"
import { getCurrentLanguage } from "@/lib/i18n"

import {
  fromOptionDrafts,
  toOptionDrafts,
  uniqueKey,
  type OptionDraft,
} from "../lib/drafts"
import { useFieldTypeLabel } from "./field-type-label"
import { OptionsEditor } from "./options-editor"

interface FieldDialogProps {
  objectDef: ObjectDef
  /** Edit mode when given. */
  field?: FieldDef
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Errors = Partial<
  Record<"labelTr" | "key" | "type" | "options" | "relation", string>
>

function FieldForm({
  objectDef,
  field,
  onOpenChange,
}: Omit<FieldDialogProps, "open">) {
  const { t } = useTranslation(["settings", "common", "engine"])
  const id = useId()
  const language = getCurrentLanguage()
  const typeLabel = useFieldTypeLabel()
  const objects = useObjectDefs()
  const createField = useCreateField(objectDef.key)
  const updateField = useUpdateField(objectDef.key)
  const isEdit = !!field
  const isStageField = !!field && getStageField(objectDef)?.key === field.key

  const [labelTr, setLabelTr] = useState(field?.label.tr ?? "")
  const [labelEn, setLabelEn] = useState(field?.label.en ?? "")
  const [key, setKey] = useState(field?.key ?? "")
  const [keyTouched, setKeyTouched] = useState(isEdit)
  const [type, setType] = useState(field?.type ?? "text")
  const [required, setRequired] = useState(field?.required ?? false)
  const [options, setOptions] = useState<OptionDraft[]>(() =>
    toOptionDrafts(field?.options)
  )
  const [relationObject, setRelationObject] = useState(
    field?.relation?.objectKey ?? ""
  )
  const [helpTr, setHelpTr] = useState(field?.helpText?.tr ?? "")
  const [addToList, setAddToList] = useState(true)
  const [errors, setErrors] = useState<Errors>({})

  const types = getFieldTypes().filter((item) => item.creatable)
  const config = types.find((item) => item.type === type)?.config
  const pending = createField.isPending || updateField.isPending
  const takenKeys = objectDef.fields.map((item) => item.key)

  function validate(): Errors {
    const next: Errors = {}
    if (!labelTr.trim()) next.labelTr = t("engine:validation.required")
    if (!isEdit) {
      if (!FIELD_KEY_PATTERN.test(key)) next.key = t("fields.keyInvalid")
      else if (takenKeys.includes(key)) next.key = t("fields.keyTaken")
    }
    if (config === "options" && !isStageField) {
      const labels = options.map((item) => item.labelTr.trim())
      if (labels.length === 0) next.options = t("options.required")
      else if (labels.some((item) => !item))
        next.options = t("options.emptyLabel")
    }
    if (!isEdit && config === "relation" && !relationObject) {
      next.relation = t("fields.relationRequired")
    }
    return next
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) return

    const text = { tr: labelTr.trim(), en: labelEn.trim() || labelTr.trim() }
    const help = helpTr.trim()
      ? { tr: helpTr.trim(), en: helpTr.trim() }
      : undefined
    try {
      if (field) {
        const patch: FieldPatch = {
          label: text,
          required,
          ...(help ? { helpText: help } : {}),
          ...(config === "options" && !isStageField
            ? { options: fromOptionDrafts(options) }
            : {}),
        }
        await updateField.mutateAsync({ fieldKey: field.key, patch })
      } else {
        const relationDef = objects.find((item) => item.key === relationObject)
        const input: FieldInput = {
          key,
          label: text,
          type,
          required,
          addToList,
          ...(help ? { helpText: help } : {}),
          ...(config === "options"
            ? { options: fromOptionDrafts(options) }
            : {}),
          ...(config === "relation" && relationDef
            ? {
                relation: {
                  objectKey: relationDef.key,
                  displayField: relationDef.primaryField,
                },
              }
            : {}),
        }
        await createField.mutateAsync(input)
      }
      onOpenChange(false)
    } catch (error) {
      if (isApiError(error) && error.fieldErrors) {
        const fieldErrors = error.fieldErrors
        setErrors({
          key: fieldErrors.key?.[0],
          type: fieldErrors.type?.[0],
          options: fieldErrors.options?.[0],
          relation: fieldErrors.relation?.[0],
          labelTr: fieldErrors.label?.[0],
        })
      }
    }
  }

  const errorProps = (name: keyof Errors) =>
    errors[name]
      ? {
          "aria-invalid": true as const,
          "aria-describedby": `${id}-${name}-error`,
        }
      : {}
  const errorText = (name: keyof Errors) => (
    <FieldError id={`${id}-${name}-error`}>{errors[name]}</FieldError>
  )

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>
          {isEdit
            ? t("fields.editTitle", { label: label(field.label, language) })
            : t("fields.addTitle")}
        </DialogTitle>
        <DialogDescription>
          {t("fields.dialogDescription", {
            object: label(objectDef.label, language),
          })}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={errors.labelTr ? true : undefined}>
          <FieldLabel htmlFor={`${id}-label-tr`}>
            {t("fields.labelTr")}
          </FieldLabel>
          <Input
            id={`${id}-label-tr`}
            value={labelTr}
            autoComplete="off"
            onChange={(event) => {
              setLabelTr(event.target.value)
              if (!keyTouched)
                setKey(uniqueKey(event.target.value, takenKeys, ""))
            }}
            {...errorProps("labelTr")}
          />
          {errorText("labelTr")}
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-label-en`}>
            {t("fields.labelEn")}
          </FieldLabel>
          <Input
            id={`${id}-label-en`}
            value={labelEn}
            autoComplete="off"
            onChange={(event) => setLabelEn(event.target.value)}
          />
        </Field>
        <Field data-invalid={errors.key ? true : undefined}>
          <FieldLabel htmlFor={`${id}-key`}>{t("fields.key")}</FieldLabel>
          <Input
            id={`${id}-key`}
            value={key}
            readOnly={isEdit}
            className="font-mono"
            autoComplete="off"
            onChange={(event) => {
              setKeyTouched(true)
              setKey(event.target.value)
            }}
            {...errorProps("key")}
          />
          <FieldDescription>{t("fields.keyHelp")}</FieldDescription>
          {errorText("key")}
        </Field>
        <Field data-invalid={errors.type ? true : undefined}>
          <FieldLabel htmlFor={`${id}-type`}>{t("fields.type")}</FieldLabel>
          <Select
            items={types.map((item) => ({
              value: item.type,
              label: typeLabel(item.type),
            }))}
            value={type}
            disabled={isEdit}
            onValueChange={(value) => {
              if (typeof value === "string") setType(value)
            }}
          >
            <SelectTrigger
              id={`${id}-type`}
              className="w-full"
              {...errorProps("type")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {types.map((item) => (
                <SelectItem key={item.type} value={item.type}>
                  {typeLabel(item.type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errorText("type")}
        </Field>
      </div>

      {config === "relation" ? (
        <Field data-invalid={errors.relation ? true : undefined}>
          <FieldLabel htmlFor={`${id}-relation`}>
            {t("fields.relationObject")}
          </FieldLabel>
          <Select
            items={objects.map((item) => ({
              value: item.key,
              label: label(item.label, language),
            }))}
            value={relationObject || null}
            disabled={isEdit}
            onValueChange={(value) => {
              if (typeof value === "string") setRelationObject(value)
            }}
          >
            <SelectTrigger
              id={`${id}-relation`}
              className="w-full"
              {...errorProps("relation")}
            >
              <SelectValue placeholder={t("engine:input.selectPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {objects.map((item) => (
                <SelectItem key={item.key} value={item.key}>
                  {label(item.label, language)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errorText("relation")}
        </Field>
      ) : null}

      {config === "options" ? (
        isStageField ? (
          <p className="text-sm text-muted-foreground">
            {t("fields.stageOptionsHint")}
          </p>
        ) : (
          <Field data-invalid={errors.options ? true : undefined}>
            <FieldLabel htmlFor={`${id}-options`}>
              {t("options.label")}
            </FieldLabel>
            <OptionsEditor
              id={`${id}-options`}
              options={options}
              onChange={setOptions}
              invalid={!!errors.options}
              describedBy={errors.options ? `${id}-options-error` : undefined}
            />
            {errorText("options")}
          </Field>
        )
      ) : null}

      <Field>
        <FieldLabel htmlFor={`${id}-help`}>{t("fields.helpText")}</FieldLabel>
        <Input
          id={`${id}-help`}
          value={helpTr}
          onChange={(event) => setHelpTr(event.target.value)}
        />
      </Field>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${id}-required`}
            checked={required}
            disabled={field?.readOnly}
            onCheckedChange={setRequired}
          />
          <Label htmlFor={`${id}-required`} className="font-normal">
            {t("fields.required")}
          </Label>
        </div>
        {isEdit ? null : (
          <div className="flex items-center gap-2">
            <Checkbox
              id={`${id}-list`}
              checked={addToList}
              onCheckedChange={setAddToList}
            />
            <Label htmlFor={`${id}-list`} className="font-normal">
              {t("fields.addToList")}
            </Label>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
        >
          {t("common:actions.cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2Icon className="animate-spin" data-icon="inline-start" />
          ) : null}
          {isEdit ? t("common:actions.save") : t("fields.add")}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Create a custom field or edit an existing one (B2.7). */
export function FieldDialog(props: FieldDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        {props.open ? <FieldForm {...props} /> : null}
      </DialogContent>
    </Dialog>
  )
}
