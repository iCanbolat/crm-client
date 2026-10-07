import { Loader2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

interface SaveBarProps {
  dirty: boolean
  pending: boolean
  onSave: () => void
  onReset: () => void
}

/** Sticky "unsaved changes — reset / save" bar of the settings editors. */
export function SaveBar({ dirty, pending, onSave, onReset }: SaveBarProps) {
  const { t } = useTranslation(["settings", "common"])

  return (
    <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-2 rounded-3xl border bg-background/90 p-3 shadow-sm backdrop-blur">
      <span
        aria-live="polite"
        className="mr-auto text-sm text-muted-foreground"
      >
        {dirty ? t("save.unsaved") : t("save.upToDate")}
      </span>
      <Button variant="ghost" disabled={!dirty || pending} onClick={onReset}>
        {t("save.reset")}
      </Button>
      <Button disabled={!dirty || pending} onClick={onSave}>
        {pending ? (
          <Loader2Icon className="animate-spin" data-icon="inline-start" />
        ) : null}
        {t("common:actions.save")}
      </Button>
    </div>
  )
}
