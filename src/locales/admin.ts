import enActivities from "./en/activities.json"
import enAuth from "./en/auth.json"
import enAutomation from "./en/automation.json"
import enDashboard from "./en/dashboard.json"
import enDev from "./en/dev.json"
import enExample from "./en/example.json"
import enForms from "./en/forms.json"
import enLeads from "./en/leads.json"
import enMessaging from "./en/messaging.json"
import enNotifications from "./en/notifications.json"
import enPipelines from "./en/pipelines.json"
import enRecords from "./en/records.json"
import enReports from "./en/reports.json"
import enSettings from "./en/settings.json"
import enShell from "./en/shell.json"
import enSites from "./en/sites.json"
import enSubmissions from "./en/submissions.json"
import enWorkspace from "./en/workspace.json"
import trActivities from "./tr/activities.json"
import trAuth from "./tr/auth.json"
import trAutomation from "./tr/automation.json"
import trDashboard from "./tr/dashboard.json"
import trDev from "./tr/dev.json"
import trExample from "./tr/example.json"
import trForms from "./tr/forms.json"
import trLeads from "./tr/leads.json"
import trMessaging from "./tr/messaging.json"
import trNotifications from "./tr/notifications.json"
import trPipelines from "./tr/pipelines.json"
import trRecords from "./tr/records.json"
import trReports from "./tr/reports.json"
import trSettings from "./tr/settings.json"
import trShell from "./tr/shell.json"
import trSites from "./tr/sites.json"
import trSubmissions from "./tr/submissions.json"
import trWorkspace from "./tr/workspace.json"

/** Admin-only namespaces, loaded as their own chunk (B7.4). */
export const adminResources = {
  tr: {
    example: trExample,
    dev: trDev,
    auth: trAuth,
    workspace: trWorkspace,
    shell: trShell,
    dashboard: trDashboard,
    records: trRecords,
    pipelines: trPipelines,
    activities: trActivities,
    settings: trSettings,
    leads: trLeads,
    forms: trForms,
    submissions: trSubmissions,
    sites: trSites,
    messaging: trMessaging,
    reports: trReports,
    notifications: trNotifications,
    automation: trAutomation,
  },
  en: {
    example: enExample,
    dev: enDev,
    auth: enAuth,
    workspace: enWorkspace,
    shell: enShell,
    dashboard: enDashboard,
    records: enRecords,
    pipelines: enPipelines,
    activities: enActivities,
    settings: enSettings,
    leads: enLeads,
    forms: enForms,
    submissions: enSubmissions,
    sites: enSites,
    messaging: enMessaging,
    reports: enReports,
    notifications: enNotifications,
    automation: enAutomation,
  },
} as const
