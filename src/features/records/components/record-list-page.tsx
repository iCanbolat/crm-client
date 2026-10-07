import { useNavigate } from "@tanstack/react-router"
import { KanbanSquareIcon, PlusIcon, SearchIcon, TableIcon } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { label, type ObjectDef } from "@/engine/metadata"
import { Can } from "@/features/auth"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { getCurrentLanguage } from "@/lib/i18n"

import type { ListLayoutMode, RecordListSearch } from "../api/records.schemas"
import { FilterBar } from "./filter-bar"
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

function ListSearchInput({
  value,
  placeholder,
  onChange,
}: {
  value: string
  placeholder: string
  onChange: (value: string | undefined) => void
}) {
  const [text, setText] = useState(value)
  const debounced = useDebouncedValue(text, 300)

  useEffect(() => {
    if (debounced.trim() !== value.trim())
      onChange(debounced.trim() || undefined)
    // Only typing triggers a search; `value` changes come from the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  return (
    <InputGroup className="w-full sm:w-64">
      <InputGroupAddon>
        <SearchIcon aria-hidden />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        value={text}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => setText(event.target.value)}
      />
    </InputGroup>
  )
}

/** Generic list screen of any object: `/o/$objectKey` (B2.2). */
export function RecordListPage({
  objectDef,
  search,
  onSearchChange,
  onViewSelect,
  board,
}: RecordListPageProps) {
  const { t } = useTranslation("records")
  const language = getCurrentLanguage()
  const [creating, setCreating] = useState(false)
  const plural = label(objectDef.pluralLabel, language)
  const singular = label(objectDef.label, language)
  const showBoard = !!board && search.layout === "kanban"

  const navigate = useNavigate()
  // Objects with a dedicated create screen (e.g. the quote builder).
  const create = () =>
    objectDef.createPath
      ? void navigate({ to: objectDef.createPath } as never)
      : setCreating(true)

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
        actions={
          <>
            {board ? (
              <ToggleGroup
                variant="outline"
                spacing={0}
                aria-label={t("list.layout")}
                value={[search.layout]}
                onValueChange={(value) => {
                  const next = value[0] as ListLayoutMode | undefined
                  if (next) onSearchChange({ layout: next, page: 1 })
                }}
              >
                <ToggleGroupItem
                  value="table"
                  aria-label={t("list.tableLayout")}
                >
                  <TableIcon />
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="kanban"
                  aria-label={t("list.kanbanLayout")}
                >
                  <KanbanSquareIcon />
                </ToggleGroupItem>
              </ToggleGroup>
            ) : null}
            {createButton}
          </>
        }
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ListSearchInput
            key={search.view ?? "all"}
            value={search.q ?? ""}
            placeholder={t("list.search", { object: plural })}
            onChange={(q) => onSearchChange({ q, page: 1 })}
          />
          <ViewsMenu
            objectKey={objectDef.key}
            search={search}
            onSelect={onViewSelect}
          />
        </div>
        <FilterBar
          objectDef={objectDef}
          filters={search.filters ?? []}
          onChange={(filters) =>
            onSearchChange({
              filters: filters.length ? filters : undefined,
              page: 1,
            })
          }
        />
      </div>

      {showBoard ? (
        board
      ) : (
        <RecordTable
          objectDef={objectDef}
          search={search}
          onSearchChange={onSearchChange}
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
