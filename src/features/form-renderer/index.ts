/**
 * Form renderer core (plan B4.1): renders a form definition for the builder
 * preview and — from Faz 5 on — the public site. Depends only on the engine,
 * shared components and `lib` (kept out of the admin bundle).
 */
export { FormFieldView, formInputId, isWideField } from "./core/form-field-view"
export type { FormFieldViewProps } from "./core/form-field-view"
export { FormRenderer } from "./core/form-renderer"
export { FormThemeScope, MOBILE_PREVIEW_WIDTH } from "./core/form-theme-scope"
export type { FormDevice } from "./core/form-theme-scope"
export type { FormRendererProps } from "./core/form-renderer"
export { buildInitialAnswers, resolvePrefill } from "./core/prefill"
export type { FormRuntimeContext } from "./core/prefill"
