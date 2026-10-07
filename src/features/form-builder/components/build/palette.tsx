import { useDraggable } from "@dnd-kit/core"
import type { LucideIcon } from "lucide-react"
import type { PointerEventHandler } from "react"
import { useTranslation } from "react-i18next"

import type { FormBlockDef, FormPaletteType } from "@/engine/forms"
import { useActiveModules } from "@/features/workspace"
import { getCurrentLanguage } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"
import { cn } from "@/lib/utils"

import { PALETTE_GROUPS, PALETTE_ICONS } from "./field-kinds"

export type PaletteItem =
  | { kind: "field"; type: FormPaletteType }
  | { kind: "block"; block: FormBlockDef }

/** Drag data of palette items (see `BuildPanel`). */
export interface PaletteDragData {
  source: "palette"
  item: PaletteItem
  label: string
  icon: LucideIcon
}

export const paletteItemId = (item: PaletteItem) =>
  item.kind === "field" ? `palette:${item.type}` : `block:${item.block.id}`

function PaletteButton({
  item,
  label,
  description,
  icon: Icon,
  onAdd,
}: {
  item: PaletteItem
  label: string
  description?: string
  icon: LucideIcon
  onAdd: (item: PaletteItem) => void
}) {
  const { t } = useTranslation("forms")
  const data: PaletteDragData = { source: "palette", item, label, icon: Icon }
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: paletteItemId(item),
    data,
  })

  return (
    <li>
      <button
        ref={setNodeRef}
        type="button"
        // Pointer drag only: Enter/Space keep "click to add".
        onPointerDown={
          listeners?.onPointerDown as PointerEventHandler | undefined
        }
        onClick={() => onAdd(item)}
        aria-label={t("builder.palette.add", { label })}
        title={t("builder.palette.addHint")}
        className={cn(
          "flex w-full touch-none items-start gap-2 rounded-xl border bg-card px-3 py-2 text-left text-sm transition-colors hover:border-primary/50 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          isDragging && "opacity-50"
        )}
      >
        <Icon
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span className="flex min-w-0 flex-col">
          <span className="font-medium">{label}</span>
          {description ? (
            <span className="text-xs text-muted-foreground">{description}</span>
          ) : null}
        </span>
      </button>
    </li>
  )
}

/** Field types and module blocks the builder can add (B4.2). */
export function Palette({ onAdd }: { onAdd: (item: PaletteItem) => void }) {
  const { t } = useTranslation("forms")
  const language = getCurrentLanguage()
  const modules = useActiveModules().filter(
    (module) => module.formBlocks?.length
  )

  return (
    <nav
      aria-label={t("builder.palette.label")}
      className="flex flex-col gap-5"
    >
      {PALETTE_GROUPS.map((group) => (
        <section key={group.id} className="flex flex-col gap-2">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t(`builder.palette.groups.${group.id}`)}
          </h3>
          <ul className="grid gap-2">
            {group.types.map((type) => (
              <PaletteButton
                key={type}
                item={{ kind: "field", type }}
                label={t(`types.${type}`)}
                icon={PALETTE_ICONS[type]}
                onAdd={onAdd}
              />
            ))}
          </ul>
        </section>
      ))}
      {modules.map((module) => (
        <section key={module.id} className="flex flex-col gap-2">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("builder.palette.blocks", {
              module: resolveI18nText(module.label, language),
            })}
          </h3>
          <ul className="grid gap-2">
            {(module.formBlocks ?? []).map((block) => (
              <PaletteButton
                key={block.id}
                item={{ kind: "block", block }}
                label={resolveI18nText(block.label, language)}
                description={resolveI18nText(block.description, language)}
                icon={block.icon}
                onAdd={onAdd}
              />
            ))}
          </ul>
        </section>
      ))}
    </nav>
  )
}
