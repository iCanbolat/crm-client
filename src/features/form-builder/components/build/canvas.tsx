import { useDroppable } from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  GitBranchIcon,
  GripVerticalIcon,
  LinkIcon,
  MousePointerClickIcon,
  LanguagesIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react"
import { useEffect, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"

import { EmptyState } from "@/components/common/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getMissingTranslations, type FormField } from "@/engine/forms"
import { FormFieldView } from "@/features/form-renderer"
import { resolveI18nText } from "@/lib/i18n-text"
import { cn } from "@/lib/utils"

import { useActiveStep, useBuilder } from "../../lib/builder-store"
import { stepFields } from "../../lib/form-ops"
import { FieldKindIcon, useFieldKindLabel } from "./field-kinds"

export const CANVAS_DROP_ID = "canvas"

/** Drag data of canvas fields (see `BuildPanel`). */
export interface CanvasDragData {
  source: "canvas"
  label: string
}

/** Label used in names and announcements ("Ad soyad"). */
export function useFieldTitle() {
  const language = useBuilder((state) => state.language)
  const kindLabel = useFieldKindLabel()
  return (field: FormField) =>
    resolveI18nText(field.label, language).trim() || kindLabel(field)
}

function CanvasField({
  field,
  index,
  count,
  title,
  mappedTo,
  conditional,
  missingLanguages,
}: {
  field: FormField
  index: number
  count: number
  title: string
  mappedTo: boolean
  conditional: boolean
  missingLanguages: string[]
}) {
  const { t } = useTranslation("forms")
  const language = useBuilder((state) => state.language)
  const selected = useBuilder((state) => state.selectedId === field.id)
  const select = useBuilder((state) => state.select)
  const moveField = useBuilder((state) => state.moveField)
  const duplicateField = useBuilder((state) => state.duplicateField)
  const removeField = useBuilder((state) => state.removeField)
  const kindLabel = useFieldKindLabel()
  const data: CanvasDragData = { source: "canvas", label: title }
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id, data })
  const itemRef = useRef<HTMLLIElement | null>(null)

  // Newly added / selected fields scroll into view.
  useEffect(() => {
    if (selected)
      itemRef.current?.scrollIntoView?.({
        block: "nearest",
        behavior: "smooth",
      })
  }, [selected])

  const move = (to: number) =>
    moveField(field.id, { stepId: field.stepId, index: to })

  return (
    <li
      ref={(node) => {
        setNodeRef(node)
        itemRef.current = node
      }}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-selected={selected || undefined}
      className={cn(
        "group/field relative flex flex-col gap-3 rounded-2xl border bg-card p-3 transition-shadow",
        selected && "border-primary ring-3 ring-primary/20",
        isDragging && "z-10 shadow-lg"
      )}
      onClick={() => select(field.id)}
    >
      <div className="flex items-center gap-1.5">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="flex h-7 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label={t("builder.canvas.dragHandle", { label: title })}
        >
          <GripVerticalIcon className="size-4" aria-hidden />
        </button>
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <FieldKindIcon type={field.type} className="size-3.5" />
          <span className="truncate">{kindLabel(field)}</span>
          {mappedTo ? (
            <Badge variant="outline" className="gap-1">
              <LinkIcon aria-hidden />
              {t("builder.canvas.mapped")}
            </Badge>
          ) : null}
          {conditional ? (
            <Badge variant="outline" className="gap-1">
              <GitBranchIcon aria-hidden />
              {t("builder.canvas.conditional")}
            </Badge>
          ) : null}
          {missingLanguages.length ? (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/50 text-amber-800 dark:text-amber-300"
            >
              <LanguagesIcon aria-hidden />
              {t("builder.canvas.missingTranslation", {
                languages: missingLanguages.join(", ").toUpperCase(),
              })}
            </Badge>
          ) : null}
        </span>
        <div
          className="flex shrink-0 items-center gap-0.5"
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            type="button"
            variant={selected ? "secondary" : "ghost"}
            size="icon-xs"
            aria-pressed={selected}
            aria-label={t("builder.canvas.edit", { label: title })}
            onClick={() => select(selected ? null : field.id)}
          >
            <PencilIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={index === 0}
            aria-label={t("builder.canvas.moveUp", { label: title })}
            onClick={() => move(index - 1)}
          >
            <ArrowUpIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={index === count - 1}
            aria-label={t("builder.canvas.moveDown", { label: title })}
            onClick={() => move(index + 1)}
          >
            <ArrowDownIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t("builder.canvas.duplicate", { label: title })}
            onClick={() => duplicateField(field.id)}
          >
            <CopyIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t("builder.canvas.remove", { label: title })}
            onClick={() => removeField(field.id)}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>
      <div className="@container grid cursor-pointer gap-5 @sm:grid-cols-2">
        <FormFieldView
          field={field}
          language={language}
          idPrefix={`canvas-${field.id}`}
          required={!!field.required}
          interactive={false}
          className="@sm:col-span-2"
        />
      </div>
    </li>
  )
}

/** Fields of the active step, sortable and accepting palette drops (B4.2). */
export function Canvas() {
  const { t } = useTranslation("forms")
  const content = useBuilder((state) => state.content)
  const step = useActiveStep()
  const title = useFieldTitle()
  const fields = useMemo(() => stepFields(content, step.id), [content, step.id])
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_DROP_ID })

  const missing = useMemo(() => {
    const byField = new Map<string, Set<string>>()
    for (const item of getMissingTranslations(content)) {
      if (item.scope !== "field") continue
      byField.set(
        item.id,
        (byField.get(item.id) ?? new Set()).add(item.language)
      )
    }
    return byField
  }, [content])

  const conditional = useMemo(() => {
    const ids = new Set<string>()
    for (const rule of content.logic) {
      for (const target of rule.targets) {
        if (target.kind === "field") ids.add(target.id)
      }
    }
    return ids
  }, [content.logic])

  return (
    <div
      ref={setNodeRef}
      data-builder-canvas
      className={cn(
        "min-h-64 rounded-3xl border border-dashed bg-muted/30 p-3 transition-colors sm:p-4",
        isOver && "border-primary bg-primary/5"
      )}
    >
      {fields.length === 0 ? (
        <EmptyState
          icon={MousePointerClickIcon}
          title={t("builder.canvas.empty")}
          description={t("builder.canvas.emptyHint")}
          className="border-none"
        />
      ) : (
        <SortableContext
          items={fields.map((field) => field.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul
            aria-label={t("builder.canvas.label")}
            className="flex flex-col gap-2"
          >
            {fields.map((field, index) => (
              <CanvasField
                key={field.id}
                field={field}
                index={index}
                count={fields.length}
                title={title(field)}
                mappedTo={!!content.mapping.fields[field.id]}
                conditional={conditional.has(field.id)}
                missingLanguages={[...(missing.get(field.id) ?? [])]}
              />
            ))}
          </ul>
        </SortableContext>
      )}
    </div>
  )
}
