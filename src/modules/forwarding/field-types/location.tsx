import { useQuery } from "@tanstack/react-query"
import { AnchorIcon, MapPinIcon, PlaneIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { LabelledComboboxInput } from "@/components/common/combobox-input"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  EmptyValue,
  type FieldInputProps,
  type FieldTypeDefinition,
} from "@/engine/field-types"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

import { referenceQueries } from "../api/reference.queries"
import {
  locationSchema,
  type LocationKind,
  type LocationValue,
} from "../api/reference.schemas"

export function toLocation(value: unknown): LocationValue | null {
  const parsed = locationSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/** "Hamburg (DEHAM)" */
export function formatLocation(value: LocationValue) {
  return `${value.name} (${value.code})`
}

const KIND_ICONS = {
  port: AnchorIcon,
  airport: PlaneIcon,
  city: MapPinIcon,
} as const

function LocationLabel({ value }: { value: LocationValue }) {
  const Icon = KIND_ICONS[value.kind]
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="truncate">{value.name}</span>
      <span className="font-mono text-xs text-muted-foreground">
        {value.code}
      </span>
    </span>
  )
}

const SEARCH_DEBOUNCE_MS = 200

function createLocationInput(
  kinds: readonly LocationKind[],
  placeholderKey: "searchLocation" | "searchPort" | "searchAirport"
) {
  return function LocationInput(props: FieldInputProps<LocationValue>) {
    const { t } = useTranslation(["forwarding", "engine"])
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const current = toLocation(props.value)
    const debounced = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS)
    // The selected label echoed back into the box is not a new search.
    const term =
      current && debounced === formatLocation(current) ? "" : debounced
    const search = useQuery({
      ...referenceQueries.locations(term, kinds),
      enabled: open,
    })

    return (
      <Combobox<LocationValue>
        items={search.data ?? []}
        filter={null}
        value={current}
        onValueChange={(item) => props.onChange(item ?? null)}
        onInputValueChange={setQuery}
        onOpenChange={setOpen}
        itemToStringLabel={formatLocation}
        isItemEqualToValue={(item, value) => item.code === value.code}
        disabled={props.disabled}
      >
        <LabelledComboboxInput
          triggerLabel={t("engine:input.openList")}
          clearLabel={t("engine:input.clear")}
          id={props.id}
          className="w-full"
          placeholder={t(`forwarding:fieldTypes.${placeholderKey}`)}
          onBlur={props.onBlur}
          autoFocus={props.autoFocus}
          aria-invalid={props.invalid ? true : undefined}
          aria-describedby={props.describedBy}
          aria-label={props.ariaLabel}
          showClear={!props.field.required && current !== null}
        />
        <ComboboxContent>
          <ComboboxEmpty>
            {search.isFetching
              ? t("engine:input.searching")
              : t("engine:input.noResults")}
          </ComboboxEmpty>
          <ComboboxList>
            {(item: LocationValue) => (
              <ComboboxItem key={item.code} value={item}>
                <LocationLabel value={item} />
                <span className="ml-auto text-xs text-muted-foreground">
                  {item.country} ·{" "}
                  {t(`forwarding:fieldTypes.kind.${item.kind}`)}
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    )
  }
}

function createLocationType(
  type: string,
  kinds: readonly LocationKind[],
  placeholderKey: "searchLocation" | "searchPort" | "searchAirport",
  icon: typeof MapPinIcon
): FieldTypeDefinition<LocationValue> {
  return {
    type,
    icon,
    toZod: () => locationSchema.refine((value) => kinds.includes(value.kind)),
    isEmpty: (value) => toLocation(value) === null,
    // Name first: sorting by location reads alphabetically.
    toComparable: (value) => {
      const location = toLocation(value)
      return location ? `${location.name} ${location.code}` : null
    },
    format: (value) => formatLocation(value),
    filterOperators: ["contains", "notContains", "isEmpty", "isNotEmpty"],
    sortable: true,
    creatable: true,
    Cell: ({ value }) => {
      const location = toLocation(value)
      return location ? <LocationLabel value={location} /> : <EmptyValue />
    },
    Input: createLocationInput(kinds, placeholderKey),
  }
}

export const portFieldType = createLocationType(
  "port",
  ["port"],
  "searchPort",
  AnchorIcon
)
export const airportFieldType = createLocationType(
  "airport",
  ["airport"],
  "searchAirport",
  PlaneIcon
)
export const locationFieldType = createLocationType(
  "location",
  ["port", "airport", "city"],
  "searchLocation",
  MapPinIcon
)
