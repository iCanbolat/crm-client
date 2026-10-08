import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangleIcon } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  isValidTemplateParam,
  renderTemplate,
  TEMPLATE_LANGUAGES,
  type TemplateLanguage,
} from "@/engine/messaging"
import { useObjectDefs } from "@/features/records"
import { useWorkspace } from "@/features/workspace"
import { getErrorMessage } from "@/lib/api"
import { getCurrentLanguage } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"

import { sendMessage, startConversation } from "../../api/messaging.api"
import { messagingKeys } from "../../api/messaging.keys"
import { messagingQueries } from "../../api/messaging.queries"
import type {
  Conversation,
  MessageTemplate,
  RecordLink,
} from "../../api/messaging.schemas"
import { isApproved, sourceFieldLabel } from "../../lib/templates"
import { TemplateBubble } from "./template-bubble"

interface TemplateSendDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Existing conversation; started from `record` when missing. */
  conversation: Conversation | null
  /** Record the message is about: fills the variables. */
  record: RecordLink | null
  optIn: boolean
  onSent?: (conversationId: string) => void
}

const NONE = "__none"

/** Pick an approved template, check its variables, send it (B6.4). */
export function TemplateSendDialog({
  open,
  onOpenChange,
  conversation,
  record,
  optIn,
  onSent,
}: TemplateSendDialogProps) {
  const { t } = useTranslation("messaging")
  const id = useId()
  const uiLanguage = getCurrentLanguage()
  const workspace = useWorkspace()
  const objectDefs = useObjectDefs()
  const queryClient = useQueryClient()
  const templates = useQuery({ ...messagingQueries.templates(), enabled: open })
  const [language, setLanguage] = useState<TemplateLanguage>(
    workspace.language === "en" ? "en" : "tr"
  )
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  /** Picked record per template object (`undefined` = first candidate). */
  const [picked, setPicked] = useState<Record<string, string | null>>({})
  const [attempted, setAttempted] = useState(false)

  // From a record: its templates; from the inbox: the linked person's ones
  // are prefilled, the others take manual values.
  const contact = conversation?.contact ?? null
  const available = (templates.data ?? []).filter(
    (template) =>
      isApproved(template, language) &&
      (!record || template.objectKey === record.objectKey)
  )
  const template: MessageTemplate | undefined = available.find(
    (item) => item.id === templateId
  )
  const fixedContext =
    template && record?.objectKey === template.objectKey
      ? record
      : template && contact?.objectKey === template.objectKey
        ? contact
        : null
  // From the inbox: the customer's records of the template's object.
  const candidates = useQuery({
    ...messagingQueries.conversationRecords(
      conversation?.id ?? "",
      template?.objectKey ?? ""
    ),
    enabled: open && !!template && !fixedContext && !!conversation,
  })
  const pickedId = template ? picked[template.objectKey] : undefined
  const candidate =
    pickedId === null
      ? null
      : (candidates.data?.find((item) => item.recordId === pickedId) ??
        (pickedId === undefined ? candidates.data?.[0] : undefined) ??
        null)
  const context = fixedContext ?? candidate
  const resolved = useQuery({
    ...messagingQueries.templateParams(
      templateId ?? "",
      language,
      context
        ? { objectKey: context.objectKey, recordId: context.recordId }
        : null,
      conversation?.id ?? null
    ),
    enabled: open && !!template,
  })
  const overrideKey = (index: number) =>
    `${templateId}:${language}:${context?.recordId ?? ""}:${index}`
  const params = template
    ? template.variables.map(
        (_, index) =>
          overrides[overrideKey(index)] ?? resolved.data?.params[index] ?? ""
      )
    : []
  const preview = template
    ? renderTemplate(template.content[language], params)
    : null
  const valid = params.every(isValidTemplateParam)

  const send = useMutation({
    mutationFn: async () => {
      const target =
        conversation ??
        (await startConversation({
          objectKey: record!.objectKey,
          recordId: record!.recordId,
        }))
      await sendMessage(target.id, {
        type: "template",
        templateId: template!.id,
        language,
        record: context
          ? { objectKey: context.objectKey, recordId: context.recordId }
          : null,
        params,
      })
      return target
    },
    meta: { suppressErrorToast: true },
    onSuccess: (target) => {
      void queryClient.invalidateQueries({
        queryKey: messagingKeys.conversations(),
      })
      toast.success(t("sendTemplate.sent"))
      onSent?.(target.id)
      onOpenChange(false)
      setTemplateId(null)
      setOverrides({})
      setPicked({})
      setAttempted(false)
    },
  })

  const templateItems = [
    { value: NONE, label: t("sendTemplate.templatePlaceholder") },
    ...available.map((item) => ({
      value: item.id,
      label: resolveI18nText(item.label, uiLanguage),
    })),
  ]
  const languageItems = TEMPLATE_LANGUAGES.map((value) => ({
    value,
    label: t(`templates.languages.${value}`),
  }))
  const recordItems = [
    { value: NONE, label: t("sendTemplate.noRecord") },
    ...(candidates.data ?? []).map((item) => ({
      value: item.recordId,
      label: item.label,
    })),
  ]
  const objectDef = template
    ? objectDefs.find((def) => def.key === template.objectKey)
    : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("sendTemplate.title")}</DialogTitle>
          <DialogDescription>{t("sendTemplate.description")}</DialogDescription>
        </DialogHeader>

        <form
          id={`${id}-form`}
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            setAttempted(true)
            if (template && valid && optIn) send.mutate()
          }}
        >
          {!optIn ? (
            <div
              role="alert"
              className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
            >
              <AlertTriangleIcon
                aria-hidden
                className="mt-0.5 size-4 shrink-0"
              />
              <span>
                {t("sendTemplate.noOptIn")} {t("sendTemplate.noOptInHint")}
              </span>
            </div>
          ) : null}

          <FieldGroup className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <Field>
              <FieldLabel htmlFor={`${id}-template`}>
                {t("sendTemplate.template")}
              </FieldLabel>
              <Select
                items={templateItems}
                value={templateId ?? NONE}
                onValueChange={(value) =>
                  setTemplateId(value === NONE ? null : (value as string))
                }
              >
                <SelectTrigger id={`${id}-template`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templateItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-language`}>
                {t("sendTemplate.language")}
              </FieldLabel>
              <Select
                items={languageItems}
                value={language}
                onValueChange={(value) =>
                  setLanguage(value as TemplateLanguage)
                }
              >
                <SelectTrigger id={`${id}-language`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languageItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>

          {templates.isSuccess && available.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("sendTemplate.noTemplates")}
            </p>
          ) : null}

          {fixedContext ? (
            <p className="text-sm text-muted-foreground">
              {t("sendTemplate.record", { label: fixedContext.label })}
            </p>
          ) : template && candidates.data?.length ? (
            <Field>
              <FieldLabel htmlFor={`${id}-record`}>
                {t("sendTemplate.relatedRecord")}
              </FieldLabel>
              <Select
                items={recordItems}
                value={candidate?.recordId ?? NONE}
                onValueChange={(value) =>
                  setPicked((current) => ({
                    ...current,
                    [template.objectKey]:
                      value === NONE ? null : (value as string),
                  }))
                }
              >
                <SelectTrigger id={`${id}-record`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {recordItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          {template ? (
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 text-sm font-medium">
                {t("sendTemplate.variables")}
              </legend>
              {template.variables.map((variable, index) => {
                const inputId = `${id}-param-${index}`
                const source =
                  variable.source.kind === "field"
                    ? (sourceFieldLabel(
                        variable.source,
                        objectDef,
                        uiLanguage
                      ) ?? "")
                    : t(`templates.sources.${variable.source.kind}`)
                const value = params[index] ?? ""
                const invalid = attempted && !isValidTemplateParam(value)
                return (
                  <Field key={index} data-invalid={invalid ? true : undefined}>
                    <FieldLabel htmlFor={inputId}>
                      {t("sendTemplate.variable", { n: index + 1, source })}
                    </FieldLabel>
                    <Input
                      id={inputId}
                      value={value}
                      placeholder={variable.example[language]}
                      aria-invalid={invalid ? true : undefined}
                      onChange={(event) =>
                        setOverrides((current) => ({
                          ...current,
                          [overrideKey(index)]: event.target.value,
                        }))
                      }
                    />
                  </Field>
                )
              })}
              {attempted && !valid ? (
                <p className="text-sm text-destructive">
                  {t("sendTemplate.missing")}
                </p>
              ) : null}
            </fieldset>
          ) : null}

          {preview ? (
            <figure className="flex flex-col gap-2">
              <figcaption className="text-sm font-medium">
                {t("sendTemplate.preview")}
              </figcaption>
              <TemplateBubble {...preview} />
            </figure>
          ) : null}

          {send.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {getErrorMessage(send.error)}
            </p>
          ) : null}
        </form>

        <DialogFooter>
          <Button
            type="submit"
            form={`${id}-form`}
            disabled={!template || !optIn || send.isPending}
          >
            {t("sendTemplate.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
