import { useQuery } from "@tanstack/react-query"

import { getMessageTemplates } from "@/engine/modules"
import { label } from "@/engine/metadata"
import { formQueries } from "@/features/form-builder"
import { directoryQueries, useObjectDefs } from "@/features/records"
import { useWorkspace } from "@/features/workspace"
import { getCurrentLanguage } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"

import type { AutomationLabels } from "../lib/describe"

const ALL_FORMS = { page: 1, pageSize: 100 } as const

/** Everything the rule editor offers, plus id → name lookups. */
export function useAutomationLabels() {
  const language = getCurrentLanguage()
  const workspace = useWorkspace()
  const objects = useObjectDefs()
  const forms = useQuery(formQueries.list(ALL_FORMS))
  const users = useQuery(directoryQueries.users())
  const templates = getMessageTemplates(workspace.modules).map(
    ({ template }) => template
  )
  const members = (users.data?.data ?? []).filter(
    (user) => user.role !== "viewer"
  )

  const labels: AutomationLabels = {
    objectLabel: (key) => {
      const def = objects.find((item) => item.key === key)
      return def ? label(def.label, language) : key
    },
    stageLabel: (objectKey, stage) => {
      const def = objects.find((item) => item.key === objectKey)
      const found = def?.pipeline?.stages.find((item) => item.key === stage)
      return found ? label(found.label, language) : stage
    },
    formName: (id) =>
      forms.data?.data.find((form) => form.id === id)?.name ?? id,
    userName: (id) =>
      users.data?.data.find((user) => user.id === id)?.name ?? id,
    templateLabel: (id) => {
      const template = templates.find((item) => item.id === id)
      return template ? resolveI18nText(template.label, language) : id
    },
  }

  return {
    labels,
    objects,
    forms: forms.data?.data ?? [],
    members,
    templates,
  }
}
