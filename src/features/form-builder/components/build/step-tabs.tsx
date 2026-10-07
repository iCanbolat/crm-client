import { PlusIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import type { FormStep } from "@/engine/forms"
import { resolveI18nText } from "@/lib/i18n-text"

import { useActiveStep, useBuilder } from "../../lib/builder-store"

/** "Adım 2" when a step has no title in the shown language. */
export function useStepTitle() {
  const { t } = useTranslation("forms")
  const language = useBuilder((state) => state.language)
  const steps = useBuilder((state) => state.content.steps)
  return (step: FormStep) =>
    resolveI18nText(step.title, language).trim() ||
    t("builder.steps.untitled", { index: steps.indexOf(step) + 1 })
}

/** Step switcher above the canvas (B4.4: multi-step forms). */
export function StepTabs() {
  const { t } = useTranslation("forms")
  const steps = useBuilder((state) => state.content.steps)
  const setActiveStep = useBuilder((state) => state.setActiveStep)
  const addStep = useBuilder((state) => state.addStep)
  const active = useActiveStep()
  const title = useStepTitle()

  return (
    <div
      role="group"
      aria-label={t("builder.steps.label")}
      className="flex flex-wrap items-center gap-2"
    >
      {steps.map((step, index) => (
        <Button
          key={step.id}
          type="button"
          size="sm"
          variant={step.id === active.id ? "default" : "outline"}
          aria-current={step.id === active.id ? "step" : undefined}
          onClick={() => setActiveStep(step.id)}
        >
          <span className="text-xs">{index + 1}.</span>
          {title(step)}
        </Button>
      ))}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => addStep({ tr: "", en: "" })}
      >
        <PlusIcon data-icon="inline-start" />
        {t("builder.steps.add")}
      </Button>
    </div>
  )
}
