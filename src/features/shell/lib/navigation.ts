import {
  BellIcon,
  FileTextIcon,
  FlaskConicalIcon,
  GlobeIcon,
  MailboxIcon,
  LayoutDashboardIcon,
  ListTodoIcon,
  MessageCircleIcon,
  MessagesSquareIcon,
  ChartColumnIcon,
  UsersIcon,
  WorkflowIcon,
  type LucideIcon,
} from "lucide-react"

import type { ObjectDef } from "@/engine/metadata"
import {
  buildHref,
  resolveNavItem,
  type ModuleManifest,
  type ResolvedNavLink,
} from "@/engine/modules"
import type { Language } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"
import { can, type Action, type Resource, type Subject } from "@/lib/rbac"

export type NavLink = ResolvedNavLink

export { buildHref }

export interface NavGroup {
  id: string
  title: string
  items: NavLink[]
}

type CoreLabelKey =
  | "dashboard"
  | "tasks"
  | "members"
  | "examples"
  | "forms"
  | "submissions"
  | "site"
  | "inbox"
  | "whatsapp"
  | "reports"
  | "notifications"
  | "automations"

interface CoreNavItem {
  id: CoreLabelKey
  icon: LucideIcon
  to: string
  params?: Record<string, string>
  permission?: { action: Action; resource: Resource }
}

interface CoreNavGroup {
  id: "workspace" | "marketing" | "settings"
  items: CoreNavItem[]
}

/**
 * Core navigation. CRM objects (leads, contacts, …) are not here: each
 * sector lists them in its own groups and terms (`navGroups`, Faz 10).
 */
export const CORE_NAVIGATION: CoreNavGroup[] = [
  {
    id: "workspace",
    items: [
      { id: "dashboard", icon: LayoutDashboardIcon, to: "/dashboard" },
      { id: "tasks", icon: ListTodoIcon, to: "/tasks" },
      {
        id: "inbox",
        icon: MessagesSquareIcon,
        to: "/inbox",
        permission: { action: "read", resource: "conversation" },
      },
      {
        id: "reports",
        icon: ChartColumnIcon,
        to: "/reports",
        permission: { action: "read", resource: "report" },
      },
    ],
  },
  {
    id: "marketing",
    items: [
      {
        id: "forms",
        icon: FileTextIcon,
        to: "/forms",
        permission: { action: "read", resource: "form" },
      },
      {
        id: "submissions",
        icon: MailboxIcon,
        to: "/submissions",
        permission: { action: "read", resource: "submission" },
      },
      {
        id: "site",
        icon: GlobeIcon,
        to: "/site",
        permission: { action: "read", resource: "site" },
      },
    ],
  },
  {
    id: "settings",
    items: [
      {
        id: "members",
        icon: UsersIcon,
        to: "/settings/members",
        permission: { action: "read", resource: "member" },
      },
      {
        id: "whatsapp",
        icon: MessageCircleIcon,
        to: "/settings/whatsapp",
        permission: { action: "read", resource: "channel" },
      },
      {
        id: "automations",
        icon: WorkflowIcon,
        to: "/settings/automations",
        permission: { action: "read", resource: "automation" },
      },
      { id: "notifications", icon: BellIcon, to: "/settings/notifications" },
      { id: "examples", icon: FlaskConicalIcon, to: "/examples" },
    ],
  },
]

interface BuildNavigationOptions {
  modules: readonly ModuleManifest[]
  /** Workspace metadata: object items take label and icon from it. */
  objects: readonly ObjectDef[] | undefined
  subject: Subject | null
  language: Language
  /** Translates `shell:nav.*` / `shell:navGroups.*` keys. */
  translate: (
    key: `nav.${CoreLabelKey}` | `navGroups.${CoreNavGroup["id"]}`
  ) => string
}

/**
 * Workspace group + the sector's groups + marketing + settings, filtered by
 * the current role and the workspace metadata.
 */
export function buildNavigation({
  modules,
  objects,
  subject,
  language,
  translate,
}: BuildNavigationOptions): NavGroup[] {
  const allowed = (permission?: { action: Action; resource: Resource }) =>
    !permission || can(subject, permission.action, permission.resource)

  const toCoreGroup = (group: CoreNavGroup): NavGroup => ({
    id: group.id,
    title: translate(`navGroups.${group.id}`),
    items: group.items
      .filter((item) => allowed(item.permission))
      .map((item) => ({
        id: item.id,
        title: translate(`nav.${item.id}`),
        icon: item.icon,
        to: item.to,
        params: item.params,
        href: buildHref(item.to, item.params),
      })),
  })

  const sectorGroups: NavGroup[] = modules.flatMap((manifest) =>
    (manifest.navGroups ?? []).map((group) => ({
      id: `module:${group.id}`,
      title: resolveI18nText(group.label, language),
      items: group.items
        .filter((item) => allowed(item.permission))
        .map((item) => resolveNavItem(item, objects, language))
        .filter((item): item is NavLink => item !== null),
    }))
  )

  const coreGroup = (id: CoreNavGroup["id"]) =>
    CORE_NAVIGATION.filter((group) => group.id === id).map(toCoreGroup)

  return [
    ...coreGroup("workspace"),
    ...sectorGroups,
    ...coreGroup("marketing"),
    ...coreGroup("settings"),
  ].filter((group) => group.items.length > 0)
}

/** Matches `/o/lead` against `/o/lead/123` but not `/o/leads`. */
export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Active state of a nav link. A link to a saved view of a list (`search`)
 * is active only on that view, and the plain list link is not.
 */
export function isActiveLink(
  link: Pick<NavLink, "href" | "search">,
  pathname: string,
  search: Record<string, unknown>,
  links: readonly Pick<NavLink, "href" | "search">[]
) {
  if (!isActivePath(pathname, link.href)) return false
  const matchesSearch = (item: Pick<NavLink, "search">) =>
    Object.entries(item.search ?? {}).every(
      ([key, value]) => JSON.stringify(search[key]) === JSON.stringify(value)
    )
  if (link.search) return matchesSearch(link)
  return !links.some(
    (other) =>
      other.search &&
      other.href === link.href &&
      pathname === other.href &&
      matchesSearch(other)
  )
}
