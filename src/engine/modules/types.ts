import type { LucideIcon } from "lucide-react"
import type { ComponentType } from "react"

import type { I18nText } from "@/lib/i18n-text"
import type { Action, FieldSensitivity, Resource, Role } from "@/lib/rbac"

import type { AnyFieldTypeDefinition } from "../field-types/types"
import type { FormBlockDef } from "../forms/schemas"
import type { MessageTemplateDef, MessageTriggerDef } from "../messaging/types"
import type {
  CrmRecord,
  DetailSection,
  RecordValues,
  FieldDef,
  ObjectDef,
  PipelineDef,
  RelatedList,
} from "../metadata/schemas"
import type { ReportDef } from "../reports/types"
import type { Condition } from "../logic/conditions"

export const MODULE_IDS = [
  "forwarding",
  "visa-education",
  "health-tourism",
] as const
export type ModuleId = (typeof MODULE_IDS)[number]

export type ModuleStatus = "active" | "coming-soon"

interface NavItemBase {
  id: string
  /** Search params of the link (e.g. a saved view). */
  search?: Record<string, unknown>
  /** Hidden unless the current role is allowed to perform it. */
  permission?: { action: Action; resource: Resource }
}

/** Link to any route. */
export interface NavRouteItem extends NavItemBase {
  label: I18nText
  icon: LucideIcon
  /** Route path, e.g. `/inbox` or `/o/$objectKey`. */
  to: string
  params?: Record<string, string>
}

/**
 * Link to the list of a metadata object (`/o/$objectKey`). Label and icon
 * come from the workspace metadata unless given (a saved view, e.g.
 * "Sponsors"), so renamed objects read the same everywhere; the item is
 * hidden when the workspace has no such object (Faz 10).
 */
export interface NavObjectItem extends NavItemBase {
  objectKey: string
  label?: I18nText
  icon?: LucideIcon
}

export type NavItem = NavRouteItem | NavObjectItem

/** Sidebar group a sector contributes (e.g. "Sales", "Operations"). */
export interface NavGroupDef {
  id: string
  label: I18nText
  items: NavItem[]
}

export interface RecordSlotProps {
  objectDef: ObjectDef
  record: CrmRecord
}

/** Component a module contributes to a record page region. */
export interface SlotDef {
  id: string
  component: ComponentType<RecordSlotProps>
  /**
   * Rendered only when the object metadata has this field — e.g. a
   * commission card disappears for roles that may not read commissions
   * (sensitive fields are left out of their metadata, Faz 10).
   */
  requiresField?: string
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
  /** Hidden from roles that may not read this kind of data (Faz 10). */
  sensitivity?: FieldSensitivity
}

/** Core CRM objects every workspace starts with. */
export const CORE_OBJECT_KEYS = ["lead", "company", "contact", "deal"] as const
export type CoreObjectKey = (typeof CORE_OBJECT_KEYS)[number]

/**
 * How a sector shapes a core object (Faz 10): turned off entirely
 * (`enabled: false` — no list, record, search hit, relation or report), or
 * renamed to the sector's own term with fields that make no sense there
 * hidden. Labels and icon are written into the workspace metadata on
 * activation (the tenant may still rename them); `enabled` and
 * `hiddenFields` apply on every read.
 */
export type CoreObjectOverride =
  | { enabled: false }
  | {
      enabled?: true
      label?: I18nText
      pluralLabel?: I18nText
      icon?: string
      hiddenFields?: string[]
    }

/** Module record a lead may be converted into (e.g. a school application). */
export interface LeadConversionTarget {
  objectKey: string
  label: I18nText
  /** Preselected in the dialog when the lead matches (engine/logic). */
  defaultWhen?: Condition[]
  /**
   * Values derived from the lead on top of the fields both objects share by
   * key and type (e.g. first target country → destination).
   */
  values?: (lead: RecordValues) => RecordValues
}

/** How a module's leads are converted (B8.4). */
export interface LeadConversionDef {
  /** B2C: the lead may be converted without a company. */
  companyOptional?: boolean
  /** Values of a contact created by the conversion (e.g. its role). */
  contactValues?: RecordValues
  targets?: LeadConversionTarget[]
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
  /**
   * The sector's sidebar groups (Faz 10): its own objects and the core ones
   * (leads, contacts, …) under its own terms. The core shell only adds the
   * workspace, marketing and settings groups.
   */
  navGroups?: NavGroupDef[]
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
  /** Lead conversion options of the sector (B8.4). */
  leadConversion?: LeadConversionDef
  /**
   * The sector's names for the generic roles (Faz 10), e.g. agent →
   * "Counsellor". Permissions stay those of `lib/rbac`.
   */
  roleLabels?: Partial<Record<Role, { label: I18nText; description: I18nText }>>
  /** Core objects the sector turns off or renames (Faz 10). */
  coreObjects?: Partial<Record<CoreObjectKey, CoreObjectOverride>>
}

export function isModuleId(value: unknown): value is ModuleId {
  return MODULE_IDS.includes(value as ModuleId)
}
