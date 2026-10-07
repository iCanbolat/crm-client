import { useQuery } from "@tanstack/react-query"
import { FileIcon, Loader2Icon, PaperclipIcon, Trash2Icon } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState } from "@/components/common/error-state"
import { LoadingSkeleton } from "@/components/common/loading-skeleton"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ColorBadge, formatFileSize } from "@/engine/field-types"
import { label, type SelectOption } from "@/engine/metadata"
import { Can } from "@/features/auth"
import { formatDate } from "@/lib/format"
import { getCurrentLanguage } from "@/lib/i18n"

import {
  useDeleteAttachment,
  useUploadAttachments,
} from "../api/records.mutations"
import { recordQueries } from "../api/records.queries"
import type { Attachment } from "../api/records.schemas"

interface RecordFilesProps {
  objectKey: string
  recordId: string
  /** Document types of the object (`fileCategories`), e.g. B/L, CMR. */
  categories?: SelectOption[]
}

/** "Files" tab: record attachments (mock upload). */
export function RecordFiles({
  objectKey,
  recordId,
  categories,
}: RecordFilesProps) {
  const { t } = useTranslation(["records", "common"])
  const language = getCurrentLanguage()
  const inputRef = useRef<HTMLInputElement>(null)
  const query = useQuery(recordQueries.attachments(objectKey, recordId))
  const upload = useUploadAttachments(objectKey, recordId)
  const remove = useDeleteAttachment(objectKey, recordId)
  const [pendingDelete, setPendingDelete] = useState<Attachment | null>(null)
  const [category, setCategory] = useState<string | null>(
    categories?.[0]?.value ?? null
  )
  const categoryItems = (categories ?? []).map((option) => ({
    value: option.value,
    label: label(option.label, language),
  }))
  const categoryOf = (value: string | null | undefined) =>
    categories?.find((option) => option.value === value)

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    try {
      await upload.mutateAsync({ files: Array.from(files), category })
    } catch {
      // Toasted globally.
    } finally {
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <section
      aria-labelledby="record-files-title"
      className="flex flex-col gap-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="record-files-title"
          className="font-heading text-lg font-semibold"
        >
          {t("files.title")}
        </h2>
        <Can action="create" resource="record">
          <div className="flex flex-wrap items-center gap-2">
            {categoryItems.length ? (
              <Select
                items={categoryItems}
                value={category}
                onValueChange={(value) =>
                  setCategory(typeof value === "string" ? value : null)
                }
              >
                <SelectTrigger size="sm" aria-label={t("files.category")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <input
              ref={inputRef}
              type="file"
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-label={t("files.upload")}
              onChange={(event) => void handleFiles(event.target.files)}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={upload.isPending}
              onClick={() => inputRef.current?.click()}
            >
              {upload.isPending ? (
                <Loader2Icon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <PaperclipIcon data-icon="inline-start" />
              )}
              {t("files.upload")}
            </Button>
          </div>
        </Can>
      </div>

      {query.isPending ? (
        <LoadingSkeleton rows={3} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState
          icon={FileIcon}
          title={t("files.emptyTitle")}
          description={t("files.emptyDescription")}
        />
      ) : (
        <ul
          aria-labelledby="record-files-title"
          className="divide-y rounded-3xl border"
        >
          {query.data.data.map((file) => (
            <li key={file.id} className="flex items-center gap-3 px-4 py-3">
              <FileIcon
                className="size-5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium">{file.name}</span>
                  {categoryOf(file.category) ? (
                    <ColorBadge color={categoryOf(file.category)!.color}>
                      {label(categoryOf(file.category)!.label, language)}
                    </ColorBadge>
                  ) : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(file.size, language)} ·{" "}
                  {formatDate(file.uploadedAt, language)}
                  {file.uploadedByName ? ` · ${file.uploadedByName}` : ""}
                </span>
              </div>
              <Can
                action="delete"
                resource="record"
                target={{ ownerId: file.uploadedBy }}
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("files.delete", { name: file.name })}
                  onClick={() => setPendingDelete(file)}
                >
                  <Trash2Icon />
                </Button>
              </Can>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title={t("files.deleteTitle")}
        description={
          pendingDelete
            ? t("files.deleteDescription", { name: pendingDelete.name })
            : undefined
        }
        confirmLabel={t("common:actions.delete")}
        variant="destructive"
        isPending={remove.isPending}
        onConfirm={() =>
          pendingDelete ? remove.mutateAsync(pendingDelete.id) : undefined
        }
      />
    </section>
  )
}
