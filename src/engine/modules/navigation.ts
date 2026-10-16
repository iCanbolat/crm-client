import type { LucideIcon } from "lucide-react"

import type { Language } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"

import { getObjectIcon } from "../metadata/helpers"
import type { ObjectDef } from "../metadata/schemas"
import type { NavItem } from "./types"

/** A navigation entry ready to render (sidebar, ⌘K, dashboard cards). */
export interface ResolvedNavLink {
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

export function buildHref(to: string, params: Record<string, string> = {}) {
  return to.replace(/\$(\w+)/g, (_, name: string) =>
    encodeURIComponent(params[name] ?? "")
  )
}

/**
 * Resolves a sector nav item (Faz 10): object items take label and icon
 * from the workspace metadata; `null` when the object does not exist.
 */
export function resolveNavItem(
  item: NavItem,
  objects: readonly ObjectDef[] | undefined,
  language: Language
): ResolvedNavLink | null {
  if (!("objectKey" in item)) {
    return {
      id: item.id,
      title: resolveI18nText(item.label, language),
      icon: item.icon,
      to: item.to,
      params: item.params,
      search: item.search,
      href: buildHref(item.to, item.params),
    }
  }
  const def = objects?.find((object) => object.key === item.objectKey)
  if (!def) return null
  const to = "/o/$objectKey"
  const params = { objectKey: def.key }
  return {
    id: item.id,
    title: resolveI18nText(item.label ?? def.pluralLabel, language),
    icon: item.icon ?? getObjectIcon(def.icon),
    to,
    params,
    search: item.search,
    href: buildHref(to, params),
  }
}
