import { ArrowLeftIcon, ArrowRightIcon, Loader2Icon } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

interface StepActionsProps {
  onBack?: () => void
  isSubmitting: boolean
  submitLabel?: ReactNode
  /** Extra actions rendered next to the submit button (e.g. "Skip"). */
  children?: ReactNode
}

export function StepActions({
  onBack,
  isSubmitting,
  submitLabel,
  children,
}: StepActionsProps) {
  const { t } = useTranslation("workspace")

  return (
    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
      {onBack ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={isSubmitting}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          {t("onboarding.back")}
        </Button>
      ) : (
        <span />
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        {children}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2Icon className="animate-spin" data-icon="inline-start" />
          ) : null}
          {submitLabel ?? t("onboarding.next")}
          {submitLabel ? null : <ArrowRightIcon data-icon="inline-end" />}
        </Button>
      </div>
    </div>
  )
}

export function FormRootError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p
      role="alert"
      className="rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </p>
  )
}
