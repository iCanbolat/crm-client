import { useSuspenseQuery } from "@tanstack/react-query"
import { InboxIcon, Trash2Icon } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { EmptyState } from "@/components/common/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Can } from "@/features/auth"
import { getPageCount } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { getCurrentLanguage } from "@/lib/i18n"

import { useDeleteExample } from "../api/example.mutations"
import { exampleQueries } from "../api/example.queries"
import type { ExampleItem, ExampleListParams } from "../api/example.schemas"

interface ExampleListProps {
  params: ExampleListParams
  onPageChange: (page: number) => void
}

export function ExampleList({ params, onPageChange }: ExampleListProps) {
  const { t } = useTranslation(["example", "common"])
  const { data } = useSuspenseQuery(exampleQueries.list(params))
  const deleteMutation = useDeleteExample()
  const [pendingDelete, setPendingDelete] = useState<ExampleItem | null>(null)

  const pageCount = getPageCount(data.meta)
  const language = getCurrentLanguage()

  // Deleting the last record of the last page leaves us on an empty page.
  useEffect(() => {
    if (data.data.length === 0 && params.page > pageCount) {
      onPageChange(pageCount)
    }
  }, [data.data.length, params.page, pageCount, onPageChange])

  if (data.meta.total === 0) {
    return (
      <EmptyState
        icon={InboxIcon}
        title={t("empty.title")}
        description={t("empty.description")}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ul aria-label={t("title")} className="divide-y rounded-3xl border">
        {data.data.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div className="flex min-w-0 flex-col">
              <p className="truncate font-medium">{item.name}</p>
              <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                <time dateTime={item.createdAt}>
                  {formatDate(item.createdAt, language)}
                </time>
                {item.ownerName ? (
                  <span>{t("owner", { name: item.ownerName })}</span>
                ) : null}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge
                variant={item.status === "active" ? "secondary" : "outline"}
              >
                {t(`status.${item.status}`)}
              </Badge>
              <Can
                action="delete"
                resource="record"
                target={{ ownerId: item.ownerId }}
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("deleteLabel", { name: item.name })}
                  onClick={() => setPendingDelete(item)}
                >
                  <Trash2Icon />
                </Button>
              </Can>
            </div>
          </li>
        ))}
      </ul>

      <nav
        aria-label={t("common:pagination.label")}
        className="flex flex-wrap items-center justify-between gap-2 text-sm"
      >
        <span className="text-muted-foreground">
          {t("common:pagination.total", { count: data.meta.total })}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={params.page <= 1}
            onClick={() => onPageChange(params.page - 1)}
          >
            {t("common:actions.previous")}
          </Button>
          <span aria-live="polite">
            {t("common:pagination.pageOf", {
              page: data.meta.page,
              pageCount,
            })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={params.page >= pageCount}
            onClick={() => onPageChange(params.page + 1)}
          >
            {t("common:actions.next")}
          </Button>
        </div>
      </nav>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title={t("deleteConfirm.title")}
        description={
          pendingDelete
            ? t("deleteConfirm.description", { name: pendingDelete.name })
            : undefined
        }
        confirmLabel={t("common:actions.delete")}
        variant="destructive"
        isPending={deleteMutation.isPending}
        onConfirm={() =>
          pendingDelete
            ? deleteMutation.mutateAsync(pendingDelete.id)
            : undefined
        }
      />
    </div>
  )
}
