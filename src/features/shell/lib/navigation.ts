import {
  BuildingIcon,
  ContactIcon,
  FileTextIcon,
  FlaskConicalIcon,
  GlobeIcon,
  MailboxIcon,
  HandCoinsIcon,
  InboxIcon,
  LayoutDashboardIcon,
  ListTodoIcon,
  MessageCircleIcon,
  MessagesSquareIcon,
  ChartColumnIcon,
  ShapesIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

import type { ModuleManifest } from "@/engine/modules"
import type { Language } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"
import { can, type Action, type Resource, type Subject } from "@/lib/rbac"

export interface NavLink {
  id: string
  title: string
  icon: LucideIcon
  to: string
  params?: Record<string, string>
  /** Search params of the link (e.g. a saved view of a list). */
  search?: Record<string, unknown>
  /** Resolved path, used for active state and search. */
  href: string
}

export interface NavGroup {
  id: string
  title: string
  items: NavLink[]
}

type CoreLabelKey =
  | "dashboard"
  | "tasks"
  | "leads"
  | "companies"
  | "contacts"
  | "deals"
  | "members"
  | "objects"
  | "examples"
  | "forms"
  | "submissions"
  | "site"
  | "inbox"
  | "whatsapp"
  | "reports"

interface CoreNavItem {
  id: CoreLabelKey
  icon: LucideIcon
  to: string
  params?: Record<string, string>
  permission?: { action: Action; resource: Resource }
}

interface CoreNavGroup {
  id: "workspace" | "crm" | "marketing" | "settings"
  items: CoreNavItem[]
}

/** Core CRM navigation; sector modules append their own groups. */
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
    id: "crm",
    items: [
      {
        id: "leads",
        icon: InboxIcon,
        to: "/o/$objectKey",
        params: { objectKey: "lead" },
      },
      {
        id: "companies",
        icon: BuildingIcon,
        to: "/o/$objectKey",
        params: { objectKey: "company" },
      },
      {
        id: "contacts",
        icon: ContactIcon,
        to: "/o/$objectKey",
        params: { objectKey: "contact" },
      },
      {
        id: "deals",
        icon: HandCoinsIcon,
        to: "/o/$objectKey",
        params: { objectKey: "deal" },
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
        id: "objects",
        icon: ShapesIcon,
        to: "/settings/objects",
        permission: { action: "manage", resource: "workspace" },
      },
      {
        id: "whatsapp",
        icon: MessageCircleIcon,
        to: "/settings/whatsapp",
        permission: { action: "read", resource: "channel" },
      },
      { id: "examples", icon: FlaskConicalIcon, to: "/examples" },
    ],
  },
]

export function buildHref(to: string, params: Record<string, string> = {}) {
  return to.replace(/\$(\w+)/g, (_, name: string) =>
    encodeURIComponent(params[name] ?? "")
  )
}

interface BuildNavigationOptions {
  modules: readonly ModuleManifest[]
  subject: Subject | null
  language: Language
  /** Translates `shell:nav.*` / `shell:navGroups.*` keys. */
  translate: (
    key: `nav.${CoreLabelKey}` | `navGroups.${CoreNavGroup["id"]}`
  ) => string
}

/**
 * Core groups + one group per active module, filtered by the current role.
 * The settings group stays last.
 */
export function buildNavigation({
  modules,
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

  const moduleGroups: NavGroup[] = modules
    .filter((manifest) => manifest.navigation?.length)
    .map((manifest) => ({
      id: `module:${manifest.id}`,
      title: resolveI18nText(manifest.label, language),
      items: (manifest.navigation ?? [])
        .filter((item) => allowed(item.permission))
        .map((item) => ({
          id: item.id,
          title: resolveI18nText(item.label, language),
          icon: item.icon,
          to: item.to,
          params: item.params,
          search: item.search,
          href: buildHref(item.to, item.params),
        })),
    }))

  const coreGroups = CORE_NAVIGATION.filter((group) => group.id !== "settings")
  const settingsGroups = CORE_NAVIGATION.filter(
    (group) => group.id === "settings"
  )

  return [
    ...coreGroups.map(toCoreGroup),
    ...moduleGroups,
    ...settingsGroups.map(toCoreGroup),
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
