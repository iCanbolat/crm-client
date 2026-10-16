import { useNavigate } from "@tanstack/react-router"
import { KanbanSquareIcon, PlusIcon } from "lucide-react"
import { useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import {
  DATA_VIEW_CONTAINER,
  DataViewLayoutToggle,
  DataViewToolbar,
  type DataViewLayoutOption,
  type DataViewToolbarSlots,
} from "@/components/common/data-view"
import { PageHeader } from "@/components/common/page-header"
import { SearchInput } from "@/components/common/search-input"
import { Button } from "@/components/ui/button"
import { label, type ObjectDef } from "@/engine/metadata"
import { Can, useSession } from "@/features/auth"
import { useWorkspace } from "@/features/workspace"
import { getCurrentLanguage } from "@/lib/i18n"
import { recordScope } from "@/lib/rbac"

import type { ListLayoutMode, RecordListSearch } from "../api/records.schemas"
import { AddFilterButton, FilterChips } from "./filter-bar"
import { RecordFormSheet } from "./record-form-sheet"
import { RecordTable } from "./record-table"
import { ViewsMenu } from "./views-menu"

export interface RecordListPageProps {
  objectDef: ObjectDef
  search: RecordListSearch
  onSearchChange: (patch: Partial<RecordListSearch>) => void
  onViewSelect: (search: RecordListSearch | null) => void
  /** Kanban board of pipeline objects (provided by the pipelines feature). */
  board?: ReactNode
}

/** Generic list screen of any object: `/o/$objectKey` (B2.2). */
export function RecordListPage({
  objectDef,
  search,
  onSearchChange,
  onViewSelect,
  board,
}: RecordListPageProps) {
  const { t } = useTranslation(["records", "workspace"])
  const language = getCurrentLanguage()
  const [creating, setCreating] = useState(false)
  const plural = label(objectDef.pluralLabel, language)
  const singular = label(objectDef.label, language)
  const showBoard = !!board && search.layout === "kanban"
  const { subject } = useSession()
  const workspace = useWorkspace()
  const scoped = recordScope(subject, workspace.agentVisibility) === "assigned"

  const navigate = useNavigate()
  // Objects with a dedicated create screen (e.g. the quote builder).
  const create = () =>
    objectDef.createPath
      ? void navigate({ to: objectDef.createPath } as never)
      : setCreating(true)

  const filters = search.filters ?? []
  const changeFilters = (next: typeof filters) =>
    onSearchChange({ filters: next.length ? next : undefined, page: 1 })
  const changeLayout = (layout: string) =>
    onSearchChange({ layout: layout as ListLayoutMode, page: 1 })
  const extraLayouts: DataViewLayoutOption[] = board
    ? [
        {
          value: "kanban",
          label: t("list.kanbanLayout"),
          icon: KanbanSquareIcon,
        },
      ]
    : []

  const toolbar: DataViewToolbarSlots = {
    search: (
      <SearchInput
        key={search.view ?? "all"}
        value={search.q ?? ""}
        placeholder={t("list.search", { object: plural })}
        onChange={(q) => onSearchChange({ q, page: 1 })}
      />
    ),
    filters: (
      <>
        <ViewsMenu
          objectKey={objectDef.key}
          search={search}
          onSelect={onViewSelect}
        />
        <AddFilterButton
          objectDef={objectDef}
          filters={filters}
          onChange={changeFilters}
        />
      </>
    ),
    activeFilters: filters.length ? (
      <FilterChips
        objectDef={objectDef}
        filters={filters}
        onChange={changeFilters}
      />
    ) : undefined,
  }

  const createButton = (
    <Can action="create" resource="record">
      <Button onClick={create}>
        <PlusIcon data-icon="inline-start" />
        {t("list.create", { object: singular })}
      </Button>
    </Can>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={plural}
        description={scoped ? t("workspace:visibility.listHint") : undefined}
        actions={createButton}
      />

      {showBoard ? (
        <div className={`${DATA_VIEW_CONTAINER} flex min-w-0 flex-col gap-3`}>
          <DataViewToolbar
            {...toolbar}
            controls={
              <DataViewLayoutToggle
                value="kanban"
                onValueChange={changeLayout}
                extraLayouts={extraLayouts}
              />
            }
          />
          {board}
        </div>
      ) : (
        <RecordTable
          objectDef={objectDef}
          search={search}
          onSearchChange={onSearchChange}
          toolbar={toolbar}
          extraLayouts={extraLayouts}
          emptyAction={createButton}
        />
      )}

      <RecordFormSheet
        objectDef={objectDef}
        open={creating}
        onOpenChange={setCreating}
      />
    </div>
  )
}
