import { useTranslation } from "react-i18next"

import { getRoleLabel } from "@/engine/modules"
import { getCurrentLanguage } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"
import type { Role } from "@/lib/rbac"

import { useWorkspace } from "./use-workspace"

/**
 * Role names in the sector's terms (Faz 10), e.g. agent → "Danışman" in a
 * visa workspace; generic names elsewhere. `vertical` defaults to the
 * current workspace's sector (pass one for other workspaces / onboarding).
 */
export function useRoleLabels() {
  const { t } = useTranslation("workspace")
  const workspace = useWorkspace()
  const language = getCurrentLanguage()

  const label = (role: Role, vertical = workspace.vertical) => {
    const custom = getRoleLabel(vertical, role)
    return custom ? resolveI18nText(custom.label, language) : t(`roles.${role}`)
  }
  const description = (role: Role, vertical = workspace.vertical) => {
    const custom = getRoleLabel(vertical, role)
    return custom
      ? resolveI18nText(custom.description, language)
      : t(`roleDescriptions.${role}`)
  }
  return { label, description }
}
