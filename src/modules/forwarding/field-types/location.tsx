import { AnchorIcon, MapPinIcon, PlaneIcon } from "lucide-react"

import {
  EmptyValue,
  lazyFieldInput,
  type FieldTypeDefinition,
} from "@/engine/field-types"

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

export function LocationLabel({ value }: { value: LocationValue }) {
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
    Input: lazyFieldInput(() =>
      import("./inputs").then((module) =>
        module.createLocationInput(kinds, placeholderKey)
      )
    ),
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
