export {
  applyModuleMetadata,
  applyObjectExtension,
  getModuleObjects,
  stripInactiveModules,
} from "./merge"
export {
  getActiveModules,
  getDashboardWidgets,
  getModule,
  getModules,
  isModuleActive,
  registerModules,
} from "./registry"
export { getSlotDefs, ModuleSlot } from "./slots"
export { isModuleId, MODULE_IDS } from "./types"
export type {
  DashboardRange,
  DashboardWidgetProps,
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
