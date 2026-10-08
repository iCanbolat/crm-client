import { SearchIcon } from "lucide-react"
import { useEffect, useState } from "react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

/** Debounced list search bound to a URL search param (`q`). */
export function SearchInput({
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
