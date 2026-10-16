import { useQuery } from "@tanstack/react-query"
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
import { type FieldInputProps } from "@/engine/field-types"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

import { referenceQueries } from "../api/reference.queries"
import { type LocationKind, type LocationValue } from "../api/reference.schemas"
import { LocationLabel, formatLocation, toLocation } from "./location"

// Inputs of ./location, loaded on first render (lazyFieldInput).

const SEARCH_DEBOUNCE_MS = 200

export function createLocationInput(
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
