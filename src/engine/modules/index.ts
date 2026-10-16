export {
  applyModuleMetadata,
  applyObjectExtension,
  getModuleObjects,
  stripInactiveModules,
} from "./merge"
export {
  getActiveModules,
  getDashboardWidgets,
  getFormBlocks,
  getLeadConversion,
  getMessageTemplates,
  getMessageTriggers,
  getModule,
  getModuleReports,
  getModules,
  isModuleActive,
  mergeLeadConversion,
  registerModules,
} from "./registry"
export { getSlotDefs, ModuleSlot } from "./slots"
export { isModuleId, MODULE_IDS } from "./types"
export type {
  DashboardRange,
  DashboardWidgetProps,
  LeadConversionDef,
  LeadConversionTarget,
  ModuleId,
  ModuleManifest,
  ModuleStatus,
  NavItem,
  ObjectExtension,
  RecordSlotName,
  RecordSlotProps,
  SlotDef,
  WidgetDef,
} from "./types"
