import enCommon from "./en/common.json"
import enEngine from "./en/engine.json"
import enErrors from "./en/errors.json"
import enForwarding from "./en/forwarding.json"
import enPublic from "./en/public.json"
import enRenderer from "./en/renderer.json"
import trCommon from "./tr/common.json"
import trEngine from "./tr/engine.json"
import trErrors from "./tr/errors.json"
import trForwarding from "./tr/forwarding.json"
import trPublic from "./tr/public.json"
import trRenderer from "./tr/renderer.json"
import type trActivities from "./tr/activities.json"
import type trAuth from "./tr/auth.json"
import type trAutomation from "./tr/automation.json"
import type trDashboard from "./tr/dashboard.json"
import type trDev from "./tr/dev.json"
import type trExample from "./tr/example.json"
import type trForms from "./tr/forms.json"
import type trLeads from "./tr/leads.json"
import type trMessaging from "./tr/messaging.json"
import type trNotifications from "./tr/notifications.json"
import type trPipelines from "./tr/pipelines.json"
import type trRecords from "./tr/records.json"
import type trReports from "./tr/reports.json"
import type trSettings from "./tr/settings.json"
import type trShell from "./tr/shell.json"
import type trSites from "./tr/sites.json"
import type trSubmissions from "./tr/submissions.json"
import type trWorkspace from "./tr/workspace.json"

export const supportedLanguages = ["tr", "en"] as const
export type Language = (typeof supportedLanguages)[number]

export const fallbackLanguage: Language = "tr"
export const defaultNS = "common"

/**
 * Namespaces the public form site needs (B7.4): bundled with the entry.
 * Everything else is admin-only and loads with the admin app
 * (`@/locales/admin`, see `loadAdminResources`).
 */
export const coreResources = {
  tr: {
    common: trCommon,
    errors: trErrors,
    engine: trEngine,
    forwarding: trForwarding,
    renderer: trRenderer,
    public: trPublic,
  },
  en: {
    common: enCommon,
    errors: enErrors,
    engine: enEngine,
    forwarding: enForwarding,
    renderer: enRenderer,
    public: enPublic,
  },
} as const

/** Every namespace (types only: admin JSON is not bundled here). */
export interface AppResources {
  common: typeof trCommon
  errors: typeof trErrors
  example: typeof trExample
  dev: typeof trDev
  auth: typeof trAuth
  workspace: typeof trWorkspace
  shell: typeof trShell
  dashboard: typeof trDashboard
  engine: typeof trEngine
  records: typeof trRecords
  pipelines: typeof trPipelines
  activities: typeof trActivities
  settings: typeof trSettings
  forwarding: typeof trForwarding
  leads: typeof trLeads
  renderer: typeof trRenderer
  forms: typeof trForms
  submissions: typeof trSubmissions
  sites: typeof trSites
  public: typeof trPublic
  messaging: typeof trMessaging
  reports: typeof trReports
  notifications: typeof trNotifications
  automation: typeof trAutomation
}

export type Namespace = keyof AppResources

/** Breadcrumb labels (`shell:crumbs.*`) a route may reference in `staticData`. */
export type CrumbKey = keyof AppResources["shell"]["crumbs"]

export function isLanguage(value: unknown): value is Language {
  return supportedLanguages.includes(value as Language)
}
