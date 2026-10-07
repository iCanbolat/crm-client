import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SortableListProps<T> {
  items: readonly T[]
  getId: (item: T) => string
  /** Accessible name of each item (handle, buttons, announcements). */
  getLabel: (item: T) => string
  onReorder: (items: T[]) => void
  renderItem: (item: T, index: number) => ReactNode
  /** Accessible name of the list. */
  label: string
  className?: string
  disabled?: boolean
}

function SortableRow({
  id,
  label,
  index,
  count,
  disabled,
  onMove,
  children,
}: {
  id: string
  label: string
  index: number
  count: number
  disabled?: boolean
  onMove: (from: number, to: number) => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-2xl border bg-card px-2 py-2",
        isDragging && "z-10 shadow-lg"
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        disabled={disabled}
        className="flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
        {...attributes}
        {...listeners}
        aria-label={t("sortable.handle", { label })}
      >
        <GripVerticalIcon className="size-4" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
      <div className="flex shrink-0 gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={disabled || index === 0}
          aria-label={t("sortable.moveUp", { label })}
          onClick={() => onMove(index, index - 1)}
        >
          <ArrowUpIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={disabled || index === count - 1}
          aria-label={t("sortable.moveDown", { label })}
          onClick={() => onMove(index, index + 1)}
        >
          <ArrowDownIcon />
        </Button>
      </div>
    </li>
  )
}

/**
 * Vertical reorderable list: drag the handle (pointer or keyboard) or use
 * the up/down buttons.
 */
export function SortableList<T>({
  items,
  getId,
  getLabel,
  onReorder,
  renderItem,
  label,
  className,
  disabled,
}: SortableListProps<T>) {
  const { t } = useTranslation()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const ids = items.map(getId)
  const labelOf = (id: string | number) => {
    const item = items.find((entry) => getId(entry) === String(id))
    return item ? getLabel(item) : String(id)
  }
  const position = (id: string | number | undefined) =>
    id === undefined ? 0 : ids.indexOf(String(id)) + 1

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return
    onReorder(arrayMove([...items], from, to))
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      t("sortable.picked", {
        label: labelOf(active.id),
        position: position(active.id),
        total: items.length,
      }),
    onDragOver: ({ active, over }) =>
      t("sortable.moved", {
        label: labelOf(active.id),
        position: position(over?.id ?? active.id),
        total: items.length,
      }),
    onDragEnd: ({ active, over }) =>
      t("sortable.dropped", {
        label: labelOf(active.id),
        position: position(over?.id ?? active.id),
        total: items.length,
      }),
    onDragCancel: () => t("sortable.cancelled"),
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    move(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: t("sortable.instructions") },
      }}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul aria-label={label} className={cn("flex flex-col gap-2", className)}>
          {items.map((item, index) => (
            <SortableRow
              key={getId(item)}
              id={getId(item)}
              label={getLabel(item)}
              index={index}
              count={items.length}
              disabled={disabled}
              onMove={move}
            >
              {renderItem(item, index)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
