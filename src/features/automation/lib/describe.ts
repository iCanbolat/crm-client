import type { TFunction } from "i18next"

import type {
  AutomationAction,
  AutomationActionType,
  AutomationTrigger,
  AutomationTriggerType,
} from "@/engine/automation"

/** Names the editor and the list resolve ids with. */
export interface AutomationLabels {
  objectLabel: (objectKey: string) => string
  stageLabel: (objectKey: string, stage: string) => string
  formName: (formId: string) => string
  userName: (userId: string) => string
  templateLabel: (templateId: string) => string
}

type T = TFunction<"automation">

/** "When the Freight quote form is submitted" (list + editor summary). */
export function describeTrigger(
  trigger: AutomationTrigger,
  t: T,
  labels: AutomationLabels
) {
  switch (trigger.type) {
    case "submission.created":
      return trigger.formId
        ? t("triggers.summary.submission", {
            form: labels.formName(trigger.formId),
          })
        : t("triggers.summary.submissionAny")
    case "record.created":
      return t("triggers.summary.recordCreated", {
        object: labels.objectLabel(trigger.objectKey),
      })
    case "record.stageChanged":
      return trigger.stage
        ? t("triggers.summary.stageChanged", {
            object: labels.objectLabel(trigger.objectKey),
            stage: labels.stageLabel(trigger.objectKey, trigger.stage),
          })
        : t("triggers.summary.stageChangedAny", {
            object: labels.objectLabel(trigger.objectKey),
          })
    case "quote.noResponse":
      return t("triggers.summary.noResponse", { count: trigger.afterDays })
  }
}

export function describeAction(
  action: AutomationAction,
  t: T,
  labels: AutomationLabels
) {
  const person = (id: string) =>
    id === "owner" ? t("actions.owner") : labels.userName(id)
  switch (action.type) {
    case "assignRoundRobin":
      return t("actions.summary.assignRoundRobin", {
        users: action.userIds.map(labels.userName).join(", "),
      })
    case "createTask":
      return t("actions.summary.createTask", {
        title: action.title,
        assignee: person(action.assignee),
      })
    case "sendWhatsAppTemplate":
      return t("actions.summary.sendWhatsAppTemplate", {
        template: labels.templateLabel(action.templateId),
      })
    case "notify":
      return t("actions.summary.notify", { to: person(action.to) })
  }
}

/** Starting values when the trigger type changes in the editor. */
export function defaultTrigger(
  type: AutomationTriggerType,
  objectKey = "lead"
): AutomationTrigger {
  switch (type) {
    case "submission.created":
      return { type, formId: null }
    case "record.created":
      return { type, objectKey }
    case "record.stageChanged":
      return { type, objectKey, stage: null }
    case "quote.noResponse":
      return { type, afterDays: 2 }
  }
}

export function defaultAction(
  type: AutomationActionType,
  { templateId = "" }: { templateId?: string } = {}
): AutomationAction {
  switch (type) {
    case "assignRoundRobin":
      return { type, userIds: [] }
    case "createTask":
      return { type, title: "", dueInDays: 1, assignee: "owner" }
    case "sendWhatsAppTemplate":
      return { type, templateId }
    case "notify":
      return { type, to: "owner" }
  }
}
