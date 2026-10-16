import { ChevronDownIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getCurrentLanguage } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import type { FieldInputProps } from "../types"
import { OptionBadge } from "../ui"
import { optionItems, toList } from "./choice"

// Inputs of ./choice, loaded on first render (see ../lazy).

export function SelectInput(props: FieldInputProps<string>) {
  const { t } = useTranslation("engine")
  const language = getCurrentLanguage()
  const options = optionItems(props.field, language)
  const items = props.field.required
    ? options
    : [{ value: null, label: t("none") }, ...options]

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
        <SelectValue
          placeholder={props.placeholder || t("input.selectPlaceholder")}
        />
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

export function MultiSelectInput(props: FieldInputProps<string[]>) {
  const { t } = useTranslation("engine")
  const language = getCurrentLanguage()
  const selected = toList(props.value)
  const items = optionItems(props.field, language)

  function toggle(value: string, checked: boolean) {
    const next = checked
      ? [...selected, value]
      : selected.filter((item) => item !== value)
    // Keep the option order of the field definition.
    const ordered = items
      .map((item) => item.value)
      .filter((item) => next.includes(item))
    props.onChange(ordered.length ? ordered : null)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            id={props.id}
            type="button"
            variant="outline"
            disabled={props.disabled}
            onBlur={props.onBlur}
            aria-invalid={props.invalid ? true : undefined}
            aria-describedby={props.describedBy}
            aria-labelledby={
              props.labelId ? `${props.labelId} ${props.id}` : undefined
            }
            aria-label={props.labelId ? undefined : props.ariaLabel}
            className={cn(
              "h-auto min-h-9 w-full justify-between rounded-3xl py-1.5 font-normal",
              selected.length === 0 && "text-muted-foreground"
            )}
          />
        }
      >
        <span className="flex flex-wrap gap-1">
          {selected.length === 0
            ? t("input.selectPlaceholder")
            : selected.map((value) => (
                <OptionBadge key={value} field={props.field} value={value} />
              ))}
        </span>
        <ChevronDownIcon className="text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        {items.map((item) => (
          <DropdownMenuCheckboxItem
            key={item.value}
            checked={selected.includes(item.value)}
            onCheckedChange={(checked) => toggle(item.value, checked)}
          >
            {item.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
