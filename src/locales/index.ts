import enActivities from "./en/activities.json"
import enAuth from "./en/auth.json"
import enCommon from "./en/common.json"
import enDashboard from "./en/dashboard.json"
import enDev from "./en/dev.json"
import enEngine from "./en/engine.json"
import enErrors from "./en/errors.json"
import enExample from "./en/example.json"
import enForms from "./en/forms.json"
import enForwarding from "./en/forwarding.json"
import enLeads from "./en/leads.json"
import enPipelines from "./en/pipelines.json"
import enRecords from "./en/records.json"
import enRenderer from "./en/renderer.json"
import enSites from "./en/sites.json"
import enPublic from "./en/public.json"
import enSettings from "./en/settings.json"
import enShell from "./en/shell.json"
import enWorkspace from "./en/workspace.json"
import trActivities from "./tr/activities.json"
import trAuth from "./tr/auth.json"
import trCommon from "./tr/common.json"
import trDashboard from "./tr/dashboard.json"
import trDev from "./tr/dev.json"
import trEngine from "./tr/engine.json"
import trErrors from "./tr/errors.json"
import trExample from "./tr/example.json"
import trForms from "./tr/forms.json"
import trForwarding from "./tr/forwarding.json"
import trLeads from "./tr/leads.json"
import trPipelines from "./tr/pipelines.json"
import trRecords from "./tr/records.json"
import trRenderer from "./tr/renderer.json"
import trSites from "./tr/sites.json"
import trPublic from "./tr/public.json"
import trSettings from "./tr/settings.json"
import trShell from "./tr/shell.json"
import trWorkspace from "./tr/workspace.json"

export const supportedLanguages = ["tr", "en"] as const
export type Language = (typeof supportedLanguages)[number]

export const fallbackLanguage: Language = "tr"
export const defaultNS = "common"

export const resources = {
  tr: {
    common: trCommon,
    errors: trErrors,
    example: trExample,
    dev: trDev,
    auth: trAuth,
    workspace: trWorkspace,
    shell: trShell,
    dashboard: trDashboard,
    engine: trEngine,
    records: trRecords,
    pipelines: trPipelines,
    activities: trActivities,
    settings: trSettings,
    forwarding: trForwarding,
    leads: trLeads,
    renderer: trRenderer,
    forms: trForms,
    sites: trSites,
    public: trPublic,
  },
  en: {
    common: enCommon,
    errors: enErrors,
    example: enExample,
    dev: enDev,
    auth: enAuth,
    workspace: enWorkspace,
    shell: enShell,
    dashboard: enDashboard,
    engine: enEngine,
    records: enRecords,
    pipelines: enPipelines,
    activities: enActivities,
    settings: enSettings,
    forwarding: enForwarding,
    leads: enLeads,
    renderer: enRenderer,
    forms: enForms,
    sites: enSites,
    public: enPublic,
  },
} as const

export type Namespace = keyof (typeof resources)["tr"]

/** Breadcrumb labels (`shell:crumbs.*`) a route may reference in `staticData`. */
export type CrumbKey = keyof (typeof trShell)["crumbs"]

export function isLanguage(value: unknown): value is Language {
  return supportedLanguages.includes(value as Language)
}
