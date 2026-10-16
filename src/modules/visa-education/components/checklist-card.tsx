import { useQuery } from "@tanstack/react-query"
import {
  FileCheck2Icon,
  PlusIcon,
  SendIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"
import { useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import type { RecordSlotProps } from "@/engine/modules"
import { usePermission } from "@/features/auth"
import { useUploadAttachments } from "@/features/records"
import { resolveI18nText } from "@/lib/i18n-text"

import type { ChecklistItem } from "../api/checklists.schemas"
import {
  useChecklistMutations,
  visaEducationQueries,
} from "../api/visa-education.queries"
import { isItemOutdated } from "../lib/checklist"
import {
  CHECKLIST_STATUSES,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES,
  type ChecklistStatus,
  type DocumentType,
} from "../lib/constants"
import { Picker } from "../field-types/shared"

const STATUS_VARIANT: Record<
  ChecklistStatus,
  "secondary" | "outline" | "destructive" | "default"
> = {
  missing: "outline",
  requested: "outline",
  received: "secondary",
  approved: "default",
  rejected: "destructive",
  not_applicable: "secondary",
}

const today = () => new Date().toISOString().slice(0, 10)

/**
 * Document checklist of a school / visa application (B8.7): progress,
 * per-document status, upload straight into the item, request missing
 * documents (WhatsApp) and custom items.
 */
export function ChecklistCard({ objectDef, record }: RecordSlotProps) {
  const { t, i18n } = useTranslation("visaEducation")
  const language = i18n.language === "en" ? "en" : "tr"
  const query = useQuery(
    visaEducationQueries.checklist(objectDef.key, record.id)
  )
  const mutations = useChecklistMutations(objectDef.key, record.id)
  const canUpdate = usePermission("update", "record", {
    ownerId: record.values.ownerId as string | undefined,
  })
  const [adding, setAdding] = useState(false)

  const data = query.data
  const summary = data?.summary
  const label = (item: ChecklistItem) =>
    typeof item.label === "string"
      ? item.label
      : resolveI18nText(item.label, language)

  return (
    <Card size="sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>
          <h2 className="flex items-center gap-2">
            <FileCheck2Icon className="size-4" aria-hidden />
            {t("checklist.title")}
          </h2>
        </CardTitle>
        {canUpdate && data ? (
          <div className="flex flex-wrap gap-2">
            {summary && summary.missing > 0 ? (
              <Button
                size="sm"
                variant="outline"
                disabled={mutations.request.isPending}
                onClick={() => mutations.request.mutate()}
              >
                <SendIcon aria-hidden />
                {t("checklist.request")}
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <PlusIcon aria-hidden />
              {t("checklist.add")}
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {query.isPending ? (
          <p className="text-sm text-muted-foreground" role="status">
            {t("loading")}
          </p>
        ) : !data ? (
          <p className="text-sm text-destructive" role="alert">
            {t("checklist.error")}
          </p>
        ) : data.items.length === 0 ? (
          <div className="flex flex-col items-start gap-2 text-sm text-muted-foreground">
            <p>
              {data.templateKey
                ? t("checklist.emptyWithTemplate")
                : t(
                    `checklist.noTemplate.${objectDef.key === "enrollment" ? "enrollment" : "visa"}`
                  )}
            </p>
            {canUpdate && data.templateKey ? (
              <Button
                size="sm"
                onClick={() =>
                  mutations.applyTemplate.mutate(data.templateKey!)
                }
                disabled={mutations.applyTemplate.isPending}
              >
                {t("checklist.applyTemplate")}
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-sm">
                <span>
                  {t("checklist.progress", {
                    complete: summary!.complete,
                    required: summary!.required,
                  })}
                </span>
                {summary!.ready ? (
                  <Badge>{t("checklist.ready")}</Badge>
                ) : (
                  <Badge variant="outline">
                    {t("checklist.missing", { count: summary!.missing })}
                  </Badge>
                )}
              </div>
              <Progress
                value={Math.round(summary!.progress * 100)}
                aria-label={t("checklist.title")}
              />
            </div>
            <ul
              className="flex flex-col divide-y"
              aria-label={t("checklist.title")}
            >
              {data.items.map((item) => (
                <ChecklistRow
                  key={item.id}
                  item={item}
                  label={label(item)}
                  objectKey={objectDef.key}
                  recordId={record.id}
                  canUpdate={canUpdate}
                />
              ))}
            </ul>
          </>
        )}
      </CardContent>
      {adding ? (
        <AddItemDialog
          onClose={() => setAdding(false)}
          onSubmit={async (input) => {
            await mutations.add.mutateAsync(input)
            setAdding(false)
          }}
          pending={mutations.add.isPending}
        />
      ) : null}
    </Card>
  )
}

function ChecklistRow({
  item,
  label,
  objectKey,
  recordId,
  canUpdate,
}: {
  item: ChecklistItem
  label: string
  objectKey: string
  recordId: string
  canUpdate: boolean
}) {
  const { t } = useTranslation("visaEducation")
  const mutations = useChecklistMutations(objectKey, recordId)
  const upload = useUploadAttachments(objectKey, recordId)
  const fileInput = useRef<HTMLInputElement>(null)
  const outdated = isItemOutdated(item, today())
  const statusItems = CHECKLIST_STATUSES.map((status) => ({
    value: status,
    label: t(`checklist.status.${status}`),
  }))

  async function onFile(file: File | undefined) {
    if (!file) return
    const result = await upload
      .mutateAsync({ files: [file], category: item.category })
      .catch(() => null)
    const attachment = result?.data[0]
    if (attachment) {
      mutations.update.mutate({
        itemId: item.id,
        patch: { attachmentId: attachment.id },
      })
    }
  }

  return (
    <li
      className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center"
      data-testid="checklist-item"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {!item.required ? <span>{t("checklist.optional")}</span> : null}
          {item.attachmentId ? <span>{t("checklist.hasFile")}</span> : null}
          {item.note ? <span>· {item.note}</span> : null}
          {outdated ? (
            <Badge variant="destructive">{t("checklist.outdated")}</Badge>
          ) : null}
        </span>
      </div>
      {canUpdate ? (
        <div className="flex items-center gap-2">
          <Picker
            items={statusItems}
            value={item.status}
            label={t("checklist.statusOf", { label })}
            className="w-40"
            disabled={mutations.update.isPending}
            onChange={(status) =>
              status &&
              mutations.update.mutate({
                itemId: item.id,
                patch: { status: status as ChecklistStatus },
              })
            }
          />
          <input
            ref={fileInput}
            type="file"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              void onFile(event.target.files?.[0])
              event.target.value = ""
            }}
          />
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={t("checklist.upload", { label })}
            disabled={upload.isPending}
            onClick={() => fileInput.current?.click()}
          >
            <UploadIcon aria-hidden />
          </Button>
          {item.custom ? (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={t("checklist.remove", { label })}
              onClick={() => mutations.remove.mutate(item.id)}
            >
              <Trash2Icon aria-hidden />
            </Button>
          ) : null}
        </div>
      ) : (
        <Badge variant={STATUS_VARIANT[item.status]}>
          {t(`checklist.status.${item.status}`)}
        </Badge>
      )}
    </li>
  )
}

function AddItemDialog({
  onClose,
  onSubmit,
  pending,
}: {
  onClose: () => void
  onSubmit: (input: {
    label: string
    category: DocumentType
    required: boolean
  }) => Promise<void>
  pending: boolean
}) {
  const { t, i18n } = useTranslation(["visaEducation", "common"])
  const language = i18n.language === "en" ? "en" : "tr"
  const id = useId()
  const [label, setLabel] = useState("")
  const [category, setCategory] = useState<DocumentType>("other")
  const [required, setRequired] = useState(true)
  const categories = DOCUMENT_TYPES.map((value) => ({
    value,
    label: resolveI18nText(DOCUMENT_TYPE_LABELS[value], language),
  }))

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (label.trim()) void onSubmit({ label, category, required })
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("checklist.addTitle")}</DialogTitle>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={`${id}-label`}>
              {t("checklist.itemLabel")}
            </FieldLabel>
            <Input
              id={`${id}-label`}
              value={label}
              required
              onChange={(event) => setLabel(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-category`}>
              {t("checklist.category")}
            </FieldLabel>
            <Picker
              id={`${id}-category`}
              items={categories}
              value={category}
              label={t("checklist.category")}
              onChange={(value) => value && setCategory(value as DocumentType)}
            />
          </Field>
          <Field orientation="horizontal">
            <Checkbox
              id={`${id}-required`}
              checked={required}
              onCheckedChange={(checked) => setRequired(checked === true)}
            />
            <FieldLabel htmlFor={`${id}-required`} className="font-normal">
              {t("checklist.required")}
            </FieldLabel>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" disabled={pending || !label.trim()}>
              {t("common:actions.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
