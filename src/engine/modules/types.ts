import type { LucideIcon } from "lucide-react"
import type { ComponentType } from "react"

import type { I18nText } from "@/lib/i18n-text"
import type { Action, Resource } from "@/lib/rbac"

import type { AnyFieldTypeDefinition } from "../field-types/types"
import type { FormBlockDef } from "../forms/schemas"
import type { MessageTemplateDef, MessageTriggerDef } from "../messaging/types"
import type {
  CrmRecord,
  DetailSection,
  FieldDef,
  ObjectDef,
  PipelineDef,
  RelatedList,
} from "../metadata/schemas"
import type { ReportDef } from "../reports/types"

export const MODULE_IDS = [
  "forwarding",
  "visa-education",
  "health-tourism",
] as const
export type ModuleId = (typeof MODULE_IDS)[number]

export type ModuleStatus = "active" | "coming-soon"

export interface NavItem {
  id: string
  label: I18nText
  icon: LucideIcon
  /** Route path, e.g. `/o/$objectKey`. */
  to: string
  params?: Record<string, string>
  /** Search params of the link (e.g. a saved view). */
  search?: Record<string, unknown>
  /** Hidden unless the current role is allowed to perform it. */
  permission?: { action: Action; resource: Resource }
}

export interface RecordSlotProps {
  objectDef: ObjectDef
  record: CrmRecord
}

/** Component a module contributes to a record page region. */
export interface SlotDef {
  id: string
  component: ComponentType<RecordSlotProps>
}

/**
 * Slot regions of the generic record page, e.g. `lead.detail.sidebar`.
 * Modules fill them through `recordSlots` (B3.1).
 */
export type RecordSlotName = `${string}.detail.${"sidebar" | "main"}`

/**
 * What a module adds to an existing (core) object. Fields are tagged with
 * the module id; a replaced pipeline also rewrites its stage field options.
 */
export interface ObjectExtension {
  fields?: FieldDef[]
  /** Shallow patches of existing fields (e.g. extra select options). */
  fieldPatches?: Record<string, Partial<Omit<FieldDef, "key">>>
  pipeline?: PipelineDef
  /** Detail sections: merged by key, new ones inserted before "system". */
  sections?: DetailSection[]
  /** List columns appended to the default layout. */
  columns?: string[]
  related?: RelatedList[]
}

/** Date range every dashboard widget is filtered by (`yyyy-MM-dd`). */
export interface DashboardRange {
  from: string
  to: string
}

export interface DashboardWidgetProps {
  range: DashboardRange
}

/** Dashboard card a module contributes. */
export interface WidgetDef {
  id: string
  /** Grid columns on wide screens (of 4). */
  size: 1 | 2 | 4
  component: ComponentType<DashboardWidgetProps>
  permission?: { action: Action; resource: Resource }
}

/**
 * Module manifest (plan §4.5). The data part (`objects`, `extend`) is what
 * the backend seeds into a workspace when the module is activated; the UI
 * part (field types, navigation, slots, widgets) stays in the client.
 */
export interface ModuleManifest {
  id: ModuleId
  status: ModuleStatus
  label: I18nText
  description: I18nText
  icon: LucideIcon
  objects?: ObjectDef[]
  extend?: Record<string, ObjectExtension>
  fieldTypes?: AnyFieldTypeDefinition[]
  navigation?: NavItem[]
  recordSlots?: Partial<Record<RecordSlotName, SlotDef[]>>
  dashboardWidgets?: WidgetDef[]
  /** Sector blocks of the form builder palette (B4.2). */
  formBlocks?: FormBlockDef[]
  /**
   * WhatsApp utility templates of the sector (Faz 6): submitted to the
   * tenant's WABA on connect / activation; read-only for tenants.
   */
  messageTemplates?: MessageTemplateDef[]
  /** Events that may send a template (tenants switch each on/off). */
  messageTriggers?: MessageTriggerDef[]
  /** Ready-made reports of the sector (B7.1). */
  reports?: ReportDef[]
}

export function isModuleId(value: unknown): value is ModuleId {
  return MODULE_IDS.includes(value as ModuleId)
}
