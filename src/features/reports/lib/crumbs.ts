import { useWorkspace } from "@/features/workspace"
import { getCurrentLanguage } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"

import { findReport } from "./reports"

/** Breadcrumb label of a report page: the report's name. */
export function useReportCrumb(reportKey: string | undefined) {
  const workspace = useWorkspace()
  const def = reportKey ? findReport(reportKey, workspace.modules) : undefined
  return def ? resolveI18nText(def.label, getCurrentLanguage()) : null
}
