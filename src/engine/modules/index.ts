export {
  applyCoreObjectOverrides,
  applyModuleMetadata,
  applyObjectExtension,
  getCoreObjectOverrides,
  getDisabledObjectKeys,
  getModuleObjects,
  redactSensitiveFields,
  stripInactiveModules,
} from "./merge"
export {
  getActiveModules,
  getDashboardStats,
  getDashboardWidgets,
  getFormBlocks,
  getLeadConversion,
  getMessageTemplates,
  getMessageTriggers,
  getModule,
  getModuleReports,
  getRoleLabel,
  getModules,
  isModuleActive,
  mergeLeadConversion,
  registerModules,
} from "./registry"
export { buildHref, resolveNavItem } from "./navigation"
export type { ResolvedNavLink } from "./navigation"
export { getSlotDefs, ModuleSlot } from "./slots"
export { CORE_OBJECT_KEYS, isModuleId, MODULE_IDS } from "./types"
export type {
  CoreObjectKey,
  CoreObjectOverride,
  DashboardRange,
  DashboardWidgetProps,
  LeadConversionDef,
  LeadConversionTarget,
  ModuleId,
  ModuleManifest,
  ModuleStatus,
  NavGroupDef,
  NavItem,
  NavObjectItem,
  NavRouteItem,
  ObjectExtension,
  RecordSlotName,
  RecordSlotProps,
  SlotDef,
  StatDef,
  WidgetDef,
} from "./types"
