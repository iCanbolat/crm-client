import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { PlusIcon, Settings2Icon, type LucideIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

import { useBuilderLayout } from "../../hooks/use-wide-screen"
import {
  useActiveStep,
  useBuilder,
  useBuilderStore,
} from "../../lib/builder-store"
import { stepFields } from "../../lib/form-ops"
import { Canvas, type CanvasDragData } from "./canvas"
import { Palette, type PaletteDragData, type PaletteItem } from "./palette"
import { PropertiesPanel } from "./properties-panel"
import { StepTabs } from "./step-tabs"

type DragData = PaletteDragData | CanvasDragData

/**
 * "Alanlar" tab (B4.2): palette · canvas · properties. Palette items are
 * clicked or dragged onto the canvas; canvas fields are sorted with the
 * pointer, the keyboard (handle) or the up/down buttons.
 */
export function BuildPanel() {
  const { t } = useTranslation("forms")
  const store = useBuilderStore()
  const { dockPalette, dockProperties } = useBuilderLayout()
  const step = useActiveStep()
  const selectedId = useBuilder((state) => state.selectedId)
  const select = useBuilder((state) => state.select)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [stepSettingsOpen, setStepSettingsOpen] = useState(false)
  const [dragging, setDragging] = useState<{
    label: string
    icon?: LucideIcon
  } | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function add(item: PaletteItem, index?: number) {
    const state = store.getState()
    const at = { stepId: state.activeStepId, index }
    if (item.kind === "field") state.addPaletteField(item.type, at)
    else state.addBlock(item.block, at)
    setPaletteOpen(false)
  }

  const labelOf = (data: unknown) => (data as DragData | undefined)?.label ?? ""
  const positionOf = (id: string | number | undefined) => {
    const ids = stepFields(store.getState().content, step.id).map(
      (field) => field.id
    )
    const index = id === undefined ? -1 : ids.indexOf(String(id))
    return index === -1 ? ids.length + 1 : index + 1
  }
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      t("builder.dnd.picked", { label: labelOf(active.data.current) }),
    onDragOver: ({ active, over }) =>
      over
        ? t("builder.dnd.over", {
            label: labelOf(active.data.current),
            position: positionOf(over.id),
          })
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? t("builder.dnd.dropped", {
            label: labelOf(active.data.current),
            position: positionOf(over.id),
          })
        : t("builder.dnd.cancelled"),
    onDragCancel: () => t("builder.dnd.cancelled"),
  }

  function onDragStart({ active }: DragStartEvent) {
    const data = active.data.current as DragData | undefined
    if (data?.source === "palette")
      setDragging({ label: data.label, icon: data.icon })
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setDragging(null)
    if (!over) return
    const data = active.data.current as DragData | undefined
    const ids = stepFields(store.getState().content, step.id).map(
      (field) => field.id
    )
    const overIndex = ids.indexOf(String(over.id))
    if (data?.source === "palette") {
      add(data.item, overIndex === -1 ? undefined : overIndex)
      return
    }
    if (active.id === over.id || overIndex === -1) return
    store
      .getState()
      .moveField(String(active.id), { stepId: step.id, index: overIndex })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: t("builder.dnd.instructions") },
      }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div
        className={cn(
          "grid items-start gap-4",
          dockPalette
            ? "grid-cols-[16rem_minmax(0,1fr)_22rem]"
            : dockProperties && "grid-cols-[minmax(0,1fr)_20rem]"
        )}
      >
        {dockPalette ? (
          <aside className="sticky top-4 max-h-[calc(100dvh-8rem)] overflow-y-auto">
            <h2 className="mb-3 font-medium">{t("builder.palette.title")}</h2>
            <Palette onAdd={(item) => add(item)} />
          </aside>
        ) : null}

        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StepTabs />
            <div className="flex gap-2">
              {dockProperties ? null : (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t("builder.steps.settingsShort")}
                  onClick={() => setStepSettingsOpen(true)}
                >
                  <Settings2Icon />
                </Button>
              )}
              {dockPalette ? null : (
                <Button type="button" onClick={() => setPaletteOpen(true)}>
                  <PlusIcon data-icon="inline-start" />
                  {t("builder.palette.title")}
                </Button>
              )}
            </div>
          </div>
          <Canvas />
        </div>

        {dockProperties ? (
          <aside className="sticky top-4 max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-3xl border bg-card p-4">
            <PropertiesPanel />
          </aside>
        ) : null}
      </div>

      {dockPalette ? null : (
        <Sheet open={paletteOpen} onOpenChange={setPaletteOpen}>
          <SheetContent side="left" className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{t("builder.palette.title")}</SheetTitle>
              <SheetDescription>
                {t("builder.palette.addHint")}
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">
              <Palette onAdd={(item) => add(item)} />
            </div>
          </SheetContent>
        </Sheet>
      )}
      {dockProperties ? null : (
        <Sheet
          open={!!selectedId || stepSettingsOpen}
          onOpenChange={(open) => {
            if (open) return
            select(null)
            setStepSettingsOpen(false)
          }}
        >
          <SheetContent side="right" className="overflow-y-auto">
            <SheetHeader className="sr-only">
              <SheetTitle>{t("builder.properties.title")}</SheetTitle>
              <SheetDescription>
                {t("builder.properties.emptyHint")}
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 py-6">
              <PropertiesPanel />
            </div>
          </SheetContent>
        </Sheet>
      )}

      <DragOverlay dropAnimation={null}>
        {dragging ? (
          <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-medium shadow-lg">
            {dragging.icon ? (
              <dragging.icon className="size-4" aria-hidden />
            ) : null}
            {dragging.label}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
