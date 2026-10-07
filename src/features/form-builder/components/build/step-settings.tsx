import { ArrowLeftIcon, ArrowRightIcon, Trash2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

import { useActiveStep, useBuilder } from "../../lib/builder-store"
import { I18nTextInput } from "../i18n-text-input"
import { useStepTitle } from "./step-tabs"

/** Title, order and removal of the active step (no field selected). */
export function StepSettings() {
  const { t } = useTranslation("forms")
  const steps = useBuilder((state) => state.content.steps)
  const languages = useBuilder((state) => state.content.settings.languages)
  const updateStep = useBuilder((state) => state.updateStep)
  const moveStep = useBuilder((state) => state.moveStep)
  const removeStep = useBuilder((state) => state.removeStep)
  const step = useActiveStep()
  const title = useStepTitle()
  const index = steps.indexOf(step)

  return (
    <section
      aria-labelledby="step-settings-title"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id="step-settings-title" className="font-medium">
          {t("builder.steps.settings", { title: title(step) })}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("builder.properties.emptyHint")}
        </p>
      </div>
      <I18nTextInput
        label={t("builder.steps.title")}
        value={step.title}
        languages={languages}
        onChange={(value) => updateStep(step.id, { title: value }, "title")}
      />
      {steps.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={index === 0}
            onClick={() => moveStep(step.id, index - 1)}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            {t("builder.steps.moveEarlier")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={index === steps.length - 1}
            onClick={() => moveStep(step.id, index + 1)}
          >
            <ArrowRightIcon data-icon="inline-start" />
            {t("builder.steps.moveLater")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={() => removeStep(step.id)}
          >
            <Trash2Icon data-icon="inline-start" />
            {t("builder.steps.remove")}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t("builder.steps.removeHint")}
          </p>
        </div>
      ) : null}
    </section>
  )
}
