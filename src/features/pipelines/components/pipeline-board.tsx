import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { ColorBadge } from "@/engine/field-types"
import {
  getRecordTitle,
  getStage,
  label,
  type CrmRecord,
  type ObjectDef,
  type RecordValues,
  type StageDef,
} from "@/engine/metadata"
import { useSession } from "@/features/auth"
import {
  useMoveStage,
  useStageChange,
  type RecordListSearch,
} from "@/features/records"
import { formatMoney } from "@/lib/currencies"
import { getCurrentLanguage } from "@/lib/i18n"
import { can } from "@/lib/rbac"
import { cn } from "@/lib/utils"

import { boardKeys, boardQueries } from "../api/pipelines.queries"
import type { Board, BoardColumn, BoardParams } from "../api/pipelines.schemas"
import { findCard, moveCard } from "../lib/board"
import { columnCoordinateGetter } from "../lib/keyboard"
import { KanbanCard, KanbanCardContent } from "./kanban-card"

/** Pointer: the column under the cursor; keyboard: the overlapping column. */
const collisionDetection: CollisionDetection = (args) => {
  const pointer = pointerWithin(args)
  return pointer.length ? pointer : rectIntersection(args)
}

export function toBoardParams(search: RecordListSearch): BoardParams {
  return {
    q: search.q?.trim() || undefined,
    filters: search.filters?.length ? search.filters : undefined,
  }
}

interface PipelineBoardProps {
  objectDef: ObjectDef
  search: RecordListSearch
}

function KanbanColumn({
  objectDef,
  stage,
  column,
  canMove,
  onMove,
}: {
  objectDef: ObjectDef
  stage: StageDef
  column: BoardColumn
  canMove: (record: CrmRecord) => boolean
  onMove: (record: CrmRecord, stage: string) => void
}) {
  const { t } = useTranslation("pipelines")
  const language = getCurrentLanguage()
  const { setNodeRef, isOver } = useDroppable({ id: stage.key })
  const name = label(stage.label, language)
  const headingId = `board-column-${stage.key}`
  const hidden = column.count - column.records.length

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      data-over={isOver || undefined}
      className={cn(
        "flex w-72 shrink-0 flex-col gap-3 rounded-3xl bg-muted/50 p-3 transition-colors",
        isOver && "bg-primary/10 ring-2 ring-primary/40"
      )}
    >
      <header className="flex flex-col gap-1 px-1">
        <div className="flex items-center justify-between gap-2">
          <h2
            id={headingId}
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <ColorBadge color={stage.color}>{name}</ColorBadge>
          </h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            <span aria-hidden>{column.count}</span>
            <span className="sr-only">
              {t("column.count", { count: column.count })}
            </span>
          </span>
        </div>
        {column.totals.length ? (
          <p className="text-xs text-muted-foreground tabular-nums">
            <span className="sr-only">{t("column.total")}: </span>
            {column.totals
              .map((total) =>
                formatMoney(total.amount, total.currency, language)
              )
              .join(" · ")}
          </p>
        ) : null}
      </header>
      <ul aria-labelledby={headingId} className="flex min-h-16 flex-col gap-2">
        {column.records.map((record) => (
          <KanbanCard
            key={record.id}
            objectDef={objectDef}
            record={record}
            stage={stage.key}
            canMove={canMove(record)}
            onMove={onMove}
          />
        ))}
      </ul>
      {column.count === 0 ? (
        <p className="px-1 text-xs text-muted-foreground">
          {t("column.empty")}
        </p>
      ) : null}
      {hidden > 0 ? (
        <Link
          to="/o/$objectKey"
          params={{ objectKey: objectDef.key }}
          search={{
            layout: "table",
            filters: [
              {
                field: objectDef.pipeline!.field,
                op: "in",
                value: [stage.key],
              },
            ],
          }}
          className="px-1 text-xs text-primary underline-offset-4 hover:underline"
        >
          {t("column.more", { count: hidden })}
        </Link>
      ) : null}
    </section>
  )
}

/** Kanban view of a pipeline object (B2.5): drag, keyboard or "Move to…". */
export function PipelineBoard({ objectDef, search }: PipelineBoardProps) {
  const { t } = useTranslation("pipelines")
  const language = getCurrentLanguage()
  const queryClient = useQueryClient()
  const { subject } = useSession()
  const params = toBoardParams(search)
  const key = boardKeys.board(objectDef.key, params)
  const { data: board, isFetching } = useSuspenseQuery(
    boardQueries.board(objectDef.key, params)
  )
  const moveStage = useMoveStage(objectDef)
  const [active, setActive] = useState<CrmRecord | null>(null)

  /** Optimistic: move the card now, roll back if the API refuses. */
  async function move(record: CrmRecord, stage: string, values?: RecordValues) {
    await queryClient.cancelQueries({ queryKey: key })
    const snapshot = queryClient.getQueryData<Board>(key)
    if (snapshot) {
      queryClient.setQueryData<Board>(
        key,
        moveCard(snapshot, objectDef, record.id, stage, values)
      )
    }
    try {
      await moveStage.mutateAsync({ id: record.id, stage, values })
    } catch (error) {
      if (snapshot) queryClient.setQueryData(key, snapshot)
      throw error
    }
  }

  const { requestMove, dialog } = useStageChange(objectDef, { move })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnCoordinateGetter })
  )

  const canMove = (record: CrmRecord) =>
    can(subject, "update", "record", {
      ownerId: record.values.ownerId as string | undefined,
    })

  const stageName = (id: string | number | undefined) => {
    const stage = id === undefined ? undefined : getStage(objectDef, String(id))
    return stage ? label(stage.label, language) : String(id ?? "")
  }
  const titleOf = (id: string | number) => {
    const card = findCard(board, String(id))
    return card ? getRecordTitle(objectDef, card.record) : String(id)
  }

  const announcements: Announcements = {
    onDragStart: ({ active: item }) =>
      t("dnd.start", {
        title: titleOf(item.id),
        stage: stageName(findCard(board, String(item.id))?.stage),
      }),
    onDragOver: ({ active: item, over }) =>
      over
        ? t("dnd.over", { title: titleOf(item.id), stage: stageName(over.id) })
        : t("dnd.outside", { title: titleOf(item.id) }),
    onDragEnd: ({ active: item, over }) =>
      over
        ? t("dnd.end", { title: titleOf(item.id), stage: stageName(over.id) })
        : t("dnd.cancel", { title: titleOf(item.id) }),
    onDragCancel: ({ active: item }) =>
      t("dnd.cancel", { title: titleOf(item.id) }),
  }

  function handleDragStart(event: DragStartEvent) {
    setActive(findCard(board, String(event.active.id))?.record ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActive(null)
    const card = findCard(board, String(event.active.id))
    if (!card || !event.over) return
    const target = String(event.over.id)
    if (target !== card.stage) requestMove(card.record, target)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: t("dnd.instructions") },
      }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActive(null)}
    >
      <div
        role="region"
        aria-label={t("board.label", {
          object: label(objectDef.pluralLabel, language),
        })}
        aria-busy={isFetching || undefined}
        // `relative`: contains absolutely positioned (sr-only) descendants,
        // which would otherwise widen the whole page on mobile.
        className="relative -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 md:-mx-6 md:px-6"
      >
        {(objectDef.pipeline?.stages ?? []).map((stage) => {
          const column = board.columns.find(
            (item) => item.stage === stage.key
          ) ?? {
            stage: stage.key,
            count: 0,
            totals: [],
            records: [],
          }
          return (
            <KanbanColumn
              key={stage.key}
              objectDef={objectDef}
              stage={stage}
              column={column}
              canMove={canMove}
              onMove={requestMove}
            />
          )
        })}
      </div>
      <DragOverlay>
        {active ? (
          <div className="w-66 rotate-2 rounded-2xl border bg-card p-3 shadow-lg">
            <KanbanCardContent objectDef={objectDef} record={active} />
          </div>
        ) : null}
      </DragOverlay>
      {dialog}
    </DndContext>
  )
}
