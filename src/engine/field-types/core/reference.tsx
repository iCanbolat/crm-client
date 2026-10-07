import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Link2Icon, PlusIcon, UserIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"

import { UserAvatar } from "@/components/common/user-avatar"
import { LabelledComboboxInput } from "@/components/common/combobox-input"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { getErrorMessage } from "@/lib/api"

import type { RecordRef } from "../../metadata/schemas"
import { useFieldServices } from "../services"
import type { FieldInputProps, FieldTypeDefinition } from "../types"
import { EmptyValue } from "../ui"
import { isBlank, textComparable } from "./shared"

const ID_OPERATORS = ["in", "notIn", "isEmpty", "isNotEmpty"] as const

/* ------------------------------------------------------------------- user */

function useUserLabel(
  id: string | null | undefined,
  refValue?: RecordRef | null
) {
  const { users } = useFieldServices()
  if (!id) return null
  return refValue?.label ?? users.find((user) => user.id === id)?.name ?? id
}

function UserInput(props: FieldInputProps<string>) {
  const { t } = useTranslation("engine")
  const { users } = useFieldServices()
  const options = users.map((user) => ({ value: user.id, label: user.name }))
  // Keep an unknown current value selectable (e.g. a removed member).
  if (props.value && !options.some((item) => item.value === props.value)) {
    options.push({
      value: props.value,
      label: props.refValue?.label ?? props.value,
    })
  }
  const items = props.field.required
    ? options
    : [{ value: null as string | null, label: t("none") }, ...options]

  return (
    <Select
      items={items}
      value={props.value ?? null}
      onValueChange={(next) =>
        props.onChange(typeof next === "string" ? next : null)
      }
      disabled={props.disabled}
    >
      <SelectTrigger
        id={props.id}
        className="w-full"
        onBlur={props.onBlur}
        aria-invalid={props.invalid ? true : undefined}
        aria-describedby={props.describedBy}
        aria-label={props.labelId ? undefined : props.ariaLabel}
        autoFocus={props.autoFocus}
      >
        <SelectValue placeholder={t("input.selectPlaceholder")} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value ?? "__none"} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function UserCell({
  value,
  refValue,
}: {
  value: string | null | undefined
  refValue?: RecordRef | null
}) {
  const name = useUserLabel(value, refValue)
  if (!name) return <EmptyValue />
  return (
    <span className="inline-flex items-center gap-2">
      <UserAvatar name={name} className="size-6" />
      <span className="truncate">{name}</span>
    </span>
  )
}

export const userFieldType: FieldTypeDefinition<string> = {
  type: "user",
  icon: UserIcon,
  toZod: () => z.string().min(1),
  isEmpty: isBlank,
  toComparable: textComparable,
  format: (value, { refValue }) => refValue?.label ?? value,
  filterOperators: ID_OPERATORS,
  sortable: true,
  getOptions: (_field, { services }) =>
    services.users.map((user) => ({ value: user.id, label: user.name })),
  creatable: true,
  Cell: UserCell,
  Input: UserInput,
}

/* --------------------------------------------------------------- relation */

interface RelationItem extends RecordRef {
  /** "Create “…”" entry of the picker. */
  create?: boolean
}

const SEARCH_DEBOUNCE_MS = 250

function RelationInput(props: FieldInputProps<string>) {
  const { t } = useTranslation("engine")
  const services = useFieldServices()
  const objectKey = props.field.relation?.objectKey ?? ""
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<RelationItem | null>(() =>
    props.value
      ? { id: props.value, label: props.refValue?.label ?? props.value }
      : null
  )
  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS)

  // Typing the selected label back into the box is not a new search.
  const searchTerm =
    selected && debouncedQuery === selected.label ? "" : debouncedQuery
  const search = useQuery({
    queryKey: ["relation-search", objectKey, searchTerm],
    queryFn: ({ signal }) =>
      services.searchRecords(objectKey, searchTerm, signal),
    enabled: open && objectKey !== "",
    staleTime: 10_000,
  })

  const results: RelationItem[] = search.data ?? []
  const trimmed = query.trim()
  const canCreate =
    !!services.createRecord &&
    trimmed !== "" &&
    trimmed !== selected?.label &&
    !results.some(
      (item) =>
        item.label.toLocaleLowerCase("tr") === trimmed.toLocaleLowerCase("tr")
    )
  const items: RelationItem[] = canCreate
    ? [...results, { id: "__create__", label: trimmed, create: true }]
    : results

  // The current value may be cleared or replaced from outside (form reset).
  const current =
    props.value && selected?.id === props.value
      ? selected
      : props.value
        ? { id: props.value, label: props.refValue?.label ?? props.value }
        : null

  async function handleChange(item: RelationItem | null) {
    if (!item) {
      setSelected(null)
      props.onRefChange?.(null)
      props.onChange(null)
      return
    }
    if (!item.create) {
      setSelected(item)
      props.onRefChange?.(item)
      props.onChange(item.id)
      return
    }
    if (!services.createRecord) return
    setCreating(true)
    try {
      const created = await services.createRecord(objectKey, item.label)
      setSelected(created)
      props.onRefChange?.(created)
      props.onChange(created.id)
      toast.success(t("input.created", { label: created.label }))
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Combobox<RelationItem>
      items={items}
      filter={null}
      value={current}
      onValueChange={(item) => void handleChange(item)}
      onInputValueChange={setQuery}
      onOpenChange={setOpen}
      itemToStringLabel={(item) => item.label}
      isItemEqualToValue={(item, value) => item.id === value.id}
      disabled={props.disabled || creating}
    >
      <LabelledComboboxInput
        triggerLabel={t("input.openList")}
        clearLabel={t("input.clear")}
        id={props.id}
        className="w-full"
        placeholder={t("input.searchRecords")}
        onBlur={props.onBlur}
        autoFocus={props.autoFocus}
        aria-invalid={props.invalid ? true : undefined}
        aria-describedby={props.describedBy}
        aria-label={props.ariaLabel}
        showClear={!props.field.required && current !== null}
      />
      <ComboboxContent>
        <ComboboxEmpty>
          {search.isFetching ? t("input.searching") : t("input.noResults")}
        </ComboboxEmpty>
        <ComboboxList>
          {(item: RelationItem) => (
            <ComboboxItem key={item.id} value={item}>
              {item.create ? (
                <>
                  <PlusIcon aria-hidden />
                  {t("input.create", { label: item.label })}
                </>
              ) : (
                item.label
              )}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

function RelationCell({
  field,
  value,
  refValue,
}: {
  field: { relation?: { objectKey: string } }
  value: string | null | undefined
  refValue?: RecordRef | null
}) {
  const objectKey = field.relation?.objectKey
  if (!value || !objectKey) return <EmptyValue />
  return (
    <Link
      to="/o/$objectKey/$recordId"
      params={{ objectKey, recordId: value }}
      className="text-primary underline-offset-4 hover:underline"
      onClick={(event) => event.stopPropagation()}
    >
      {refValue?.label ?? value}
    </Link>
  )
}

export const relationFieldType: FieldTypeDefinition<string> = {
  type: "relation",
  icon: Link2Icon,
  toZod: () => z.string().min(1),
  isEmpty: isBlank,
  toComparable: textComparable,
  format: (value, { refValue }) => refValue?.label ?? value,
  filterOperators: ["eq", "neq", "isEmpty", "isNotEmpty"],
  sortable: false,
  config: "relation",
  creatable: true,
  Cell: RelationCell,
  Input: RelationInput,
}
