import { cn } from "@/lib/utils"

interface TemplateBubbleProps {
  header?: string | null
  body: string
  footer?: string | null
  className?: string
}

/** How a template message looks on the customer's phone. */
export function TemplateBubble({
  header,
  body,
  footer,
  className,
}: TemplateBubbleProps) {
  return (
    <div
      className={cn(
        "flex max-w-md flex-col gap-1.5 rounded-2xl rounded-tr-sm bg-emerald-50 px-3.5 py-2.5 text-sm text-foreground ring-1 ring-emerald-900/10 dark:bg-emerald-950 dark:ring-emerald-100/10",
        className
      )}
    >
      {header ? <p className="font-semibold">{header}</p> : null}
      <p className="whitespace-pre-wrap">{body}</p>
      {footer ? <p className="text-xs text-foreground/75">{footer}</p> : null}
    </div>
  )
}
