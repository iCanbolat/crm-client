import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { XIcon } from "lucide-react"

import { ComboboxTrigger } from "@/components/ui/combobox"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { cn } from "@/lib/utils"

interface ComboboxInputProps extends ComboboxPrimitive.Input.Props {
  /** Accessible name of the "open list" button. */
  triggerLabel: string
  /** Accessible name of the "clear" button. */
  clearLabel: string
  showClear?: boolean
}

/**
 * shadcn's `ComboboxInput` with accessible names on its icon-only trigger
 * and clear buttons (WCAG 4.1.2 — axe `button-name`).
 */
export function LabelledComboboxInput({
  className,
  disabled = false,
  showClear = false,
  triggerLabel,
  clearLabel,
  ...props
}: ComboboxInputProps) {
  return (
    <InputGroup className={cn("w-auto", className)}>
      <ComboboxPrimitive.Input
        render={<InputGroupInput disabled={disabled} />}
        {...props}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          variant="ghost"
          render={<ComboboxTrigger />}
          data-slot="input-group-button"
          aria-label={triggerLabel}
          className="group-has-data-[slot=combobox-clear]/input-group:hidden data-pressed:bg-transparent"
          disabled={disabled}
        />
        {showClear ? (
          <ComboboxPrimitive.Clear
            data-slot="combobox-clear"
            render={<InputGroupButton variant="ghost" size="icon-xs" />}
            disabled={disabled}
            aria-label={clearLabel}
          >
            <XIcon className="pointer-events-none" />
          </ComboboxPrimitive.Clear>
        ) : null}
      </InputGroupAddon>
    </InputGroup>
  )
}
