import { flexRender, type Cell, type Row } from "@tanstack/react-table"
import { Fragment, type ReactNode } from "react"

import { SELECT_COLUMN_ID } from "@/components/common/data-table"
import { cn } from "@/lib/utils"

/**
 * How a row becomes a card. Every slot names a column id, so cards reuse the
 * table's cell renderers and follow its column visibility.
 */
export interface DataCardConfig<TData> {
  /** Card heading (default: the first visible data column). */
  title?: string
  subtitle?: string
  /** Rendered top-right, e.g. a status badge. */
  badge?: string
  /** Leading visual, e.g. an avatar. */
  media?: string
  /** Row action menu, top-right corner. */
  actions?: string
  /** Label/value rows (default: every other visible column, in order). */
  fields?: string[]
  /** Full custom card; the slots above are ignored. */
  render?: (row: Row<TData>) => ReactNode
}

function renderCell<TData>(cell: Cell<TData, unknown> | undefined) {
  return cell ? flexRender(cell.column.columnDef.cell, cell.getContext()) : null
}

function cellLabel<TData>(cell: Cell<TData, unknown>) {
  const { meta, header } = cell.column.columnDef
  return meta?.label ?? (typeof header === "string" ? header : cell.column.id)
}

interface DataCardProps<TData> {
  row: Row<TData>
  config?: DataCardConfig<TData>
}

export function DataCard<TData>({ row, config = {} }: DataCardProps<TData>) {
  if (config.render) return config.render(row)

  const cells = row.getVisibleCells()
  const byId = new Map(cells.map((cell) => [cell.column.id, cell]))
  const select = byId.get(SELECT_COLUMN_ID)
  const titleId =
    config.title ??
    cells.find((cell) => cell.column.id !== SELECT_COLUMN_ID)?.column.id
  const slots = [
    SELECT_COLUMN_ID,
    titleId,
    config.subtitle,
    config.badge,
    config.media,
    config.actions,
  ]
  const fields = config.fields
    ? config.fields.flatMap((id) => byId.get(id) ?? [])
    : cells.filter((cell) => !slots.includes(cell.column.id))
  const pick = (id: string | undefined) => (id ? byId.get(id) : undefined)
  const subtitle = pick(config.subtitle)
  const badge = pick(config.badge)
  const media = pick(config.media)
  const actions = pick(config.actions)

  return (
    <article
      data-slot="data-card"
      data-state={row.getIsSelected() ? "selected" : undefined}
      className="flex h-full min-w-0 flex-col gap-3 rounded-3xl border bg-card p-4 text-sm text-card-foreground transition-colors hover:bg-muted/40 data-[state=selected]:border-primary/40 data-[state=selected]:bg-muted"
    >
      <header className="flex min-w-0 items-start gap-3">
        {select ? (
          <div className="flex h-6 items-center">{renderCell(select)}</div>
        ) : null}
        {media ? <div className="shrink-0">{renderCell(media)}</div> : null}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="min-w-0 truncate leading-6 font-medium [&_a]:max-w-full">
            {renderCell(pick(titleId))}
          </div>
          {subtitle ? (
            <div className="min-w-0 truncate text-muted-foreground">
              {renderCell(subtitle)}
            </div>
          ) : null}
        </div>
        {badge ? <div className="shrink-0">{renderCell(badge)}</div> : null}
        {actions ? (
          <div className="-mt-1 -mr-2 shrink-0">{renderCell(actions)}</div>
        ) : null}
      </header>
      {fields.length ? (
        <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] items-center gap-x-4 gap-y-2">
          {fields.map((cell) => (
            <Fragment key={cell.id}>
              <dt className="truncate text-muted-foreground">
                {cellLabel(cell)}
              </dt>
              <dd
                className={cn(
                  "flex min-w-0 justify-end truncate text-right [&>*]:min-w-0",
                  cell.column.columnDef.meta?.numeric && "tabular-nums"
                )}
              >
                {renderCell(cell)}
              </dd>
            </Fragment>
          ))}
        </dl>
      ) : null}
    </article>
  )
}
