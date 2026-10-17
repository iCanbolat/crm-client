import { cn } from "@/lib/utils"

export interface BarListItem {
  key: string
  label: string
  count: number
}

interface BarListProps {
  items: BarListItem[]
  label: string
  className?: string
}

/** Horizontal bars (no chart library: data stays readable as a list). */
export function BarList({ items, label, className }: BarListProps) {
  const max = Math.max(1, ...items.map((item) => item.count))
  return (
    <ul className={cn("flex flex-col gap-2.5", className)} aria-label={label}>
      {items.map((item) => (
        <li
          key={item.key}
          className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_2.5rem] items-center gap-3 text-sm"
        >
          <span className="truncate text-muted-foreground" title={item.label}>
            {item.label}
          </span>
          <span className="h-2.5 rounded-full bg-muted" aria-hidden>
            <span
              className="block h-2.5 rounded-full bg-[#2a78d6] dark:bg-[#3987e5]"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </span>
          <span className="text-right font-medium tabular-nums">
            {item.count}
          </span>
        </li>
      ))}
    </ul>
  )
}
