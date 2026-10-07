import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { Link } from "@tanstack/react-router"
import { ArrowRightLeftIcon, GripVerticalIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { UserAvatar } from "@/components/common/user-avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatFieldValue } from "@/engine/field-types"
import {
  getField,
  getRecordTitle,
  label,
  type CrmRecord,
  type ObjectDef,
} from "@/engine/metadata"
import { getCurrentLanguage } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface KanbanCardProps {
  objectDef: ObjectDef
  record: CrmRecord
  stage: string
  canMove: boolean
  onMove: (record: CrmRecord, stage: string) => void
  /** Rendered inside the drag overlay (no drag handlers, no menu). */
  overlay?: boolean
}

export function KanbanCardContent({
  objectDef,
  record,
}: Pick<KanbanCardProps, "objectDef" | "record">) {
  const language = getCurrentLanguage()
  const amountField = objectDef.pipeline?.amountField
    ? getField(objectDef, objectDef.pipeline.amountField)
    : undefined
  const amount = amountField
    ? formatFieldValue(amountField, record.values[amountField.key], {
        language,
      })
    : ""
  const owner = record.refs.ownerId?.label

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="line-clamp-2 text-sm font-medium break-words">
        {getRecordTitle(objectDef, record)}
      </span>
      {amount || owner ? (
        <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">{amount}</span>
          {owner ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <UserAvatar name={owner} className="size-5" />
              <span className="truncate">{owner}</span>
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  )
}

/** Draggable card; "Move to…" offers the same move without a pointer. */
export function KanbanCard({
  objectDef,
  record,
  stage,
  canMove,
  onMove,
}: KanbanCardProps) {
  const { t } = useTranslation("pipelines")
  const language = getCurrentLanguage()
  const title = getRecordTitle(objectDef, record)
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: record.id,
      data: { record, stage },
      disabled: !canMove,
    })
  const otherStages = (objectDef.pipeline?.stages ?? []).filter(
    (item) => item.key !== stage
  )

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      data-dragging={isDragging || undefined}
      className={cn(
        "group/card relative flex items-start gap-1 rounded-2xl border bg-card p-3 shadow-xs transition-shadow",
        isDragging && "opacity-40"
      )}
    >
      {canMove ? (
        <button
          type="button"
          className="-ml-1 flex h-6 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label={t("card.drag", { title })}
        >
          <GripVerticalIcon className="size-4" aria-hidden />
        </button>
      ) : null}
      <Link
        to="/o/$objectKey/$recordId"
        params={{ objectKey: objectDef.key, recordId: record.id }}
        className="min-w-0 flex-1 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <KanbanCardContent objectDef={objectDef} record={record} />
      </Link>
      {canMove ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="shrink-0"
                aria-label={t("card.moveMenu", { title })}
              />
            }
          >
            <ArrowRightLeftIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("card.moveTo")}</DropdownMenuLabel>
              {otherStages.map((item) => (
                <DropdownMenuItem
                  key={item.key}
                  onClick={() => onMove(record, item.key)}
                >
                  {label(item.label, language)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </li>
  )
}
