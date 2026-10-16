import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export interface DataViewToolbarSlots {
  /** Search input; takes the full first row in a narrow container. */
  search?: ReactNode
  /** Filter triggers next to the search (add filter, status select…). */
  filters?: ReactNode
  /** Active filter chips; one horizontally scrolling row when narrow. */
  activeFilters?: ReactNode
  /** Page actions at the end of the toolbar (export…). */
  actions?: ReactNode
}

interface DataViewToolbarProps extends DataViewToolbarSlots {
  /** View controls (sort, view options, layout toggle). */
  controls?: ReactNode
  className?: string
}

/**
 * Search and filters on the left, view controls on the right. Breakpoints
 * follow the data view container, so an open sidebar counts as well.
 */
export function DataViewToolbar({
  search,
  filters,
  activeFilters,
  actions,
  controls,
  className,
}: DataViewToolbarProps) {
  if (!search && !filters && !activeFilters && !actions && !controls) {
    return null
  }

  return (
    <div
      data-slot="data-view-toolbar"
      className={cn("flex flex-col gap-2", className)}
    >
      <div className="flex flex-wrap items-center gap-2">
        {search ? (
          <div className="w-full *:w-full! @xl/data-view:w-64">{search}</div>
        ) : null}
        {filters ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {filters}
          </div>
        ) : null}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {controls}
          {actions}
        </div>
      </div>
      {activeFilters ? (
        <div className="-mx-1 flex overflow-x-auto px-1 pb-1 @max-xl/data-view:*:flex-nowrap @xl/data-view:overflow-visible @xl/data-view:pb-0">
          {activeFilters}
        </div>
      ) : null}
    </div>
  )
}
