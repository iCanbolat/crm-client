import { CheckIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { optionColorClass } from "@/engine/field-types"
import {
  getRecordStage,
  label,
  type CrmRecord,
  type ObjectDef,
} from "@/engine/metadata"
import { getCurrentLanguage } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { useStageChange } from "../hooks/use-stage-change"

interface StageStepperProps {
  objectDef: ObjectDef
  record: CrmRecord
  canEdit: boolean
}

/** Pipeline progress of a record; a click moves it (with the stage gate). */
export function StageStepper({
  objectDef,
  record,
  canEdit,
}: StageStepperProps) {
  const { t } = useTranslation("records")
  const language = getCurrentLanguage()
  const { requestMove, dialog, isMoving } = useStageChange(objectDef)
  const pipeline = objectDef.pipeline
  if (!pipeline) return null

  const current = getRecordStage(objectDef, record)
  const currentIndex = pipeline.stages.findIndex(
    (stage) => stage.key === current?.key
  )

  return (
    <nav aria-label={t("stage.label")}>
      <ol className="flex flex-wrap gap-1.5">
        {pipeline.stages.map((stage, index) => {
          const isCurrent = stage.key === current?.key
          const isDone = currentIndex > index && stage.kind === "open"
          const name = label(stage.label, language)
          return (
            <li key={stage.key}>
              <button
                type="button"
                disabled={!canEdit || isCurrent || isMoving}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={
                  isCurrent
                    ? t("stage.current", { stage: name })
                    : t("stage.moveTo", { stage: name })
                }
                onClick={() => requestMove(record, stage.key)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors disabled:cursor-default",
                  isCurrent
                    ? cn(optionColorClass(stage.color), "border-transparent")
                    : "bg-background text-muted-foreground enabled:hover:bg-muted enabled:hover:text-foreground",
                  isDone && "text-foreground"
                )}
              >
                {isDone ? <CheckIcon className="size-3.5" aria-hidden /> : null}
                {name}
              </button>
            </li>
          )
        })}
      </ol>
      {dialog}
    </nav>
  )
}
