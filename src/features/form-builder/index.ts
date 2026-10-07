/**
 * Form builder (Faz 4): lead forms — list, drag & drop editor, logic, CRM
 * mapping, theme, publishing. Rendering lives in `@/features/form-renderer`.
 */
export { formKeys } from "./api/forms.keys"
export {
  useCreateForm,
  useDeleteForm,
  usePublishForm,
  useRestoreFormVersion,
  useUnpublishForm,
  useUpdateForm,
} from "./api/forms.mutations"
export { formQueries } from "./api/forms.queries"
export {
  createFormInputSchema,
  FORM_LIST_DEFAULTS,
  FORM_STATUSES,
  formListSearchSchema,
  formSchema,
  formSummarySchema,
  formVersionSchema,
  formVersionSummarySchema,
  updateFormInputSchema,
} from "./api/forms.schemas"
export type {
  CreateFormInput,
  Form,
  FormListParams,
  FormStatus,
  FormSummary,
  FormVersion,
  FormVersionSummary,
  UpdateFormInput,
} from "./api/forms.schemas"
export { useFormCrumb } from "./components/crumbs"
export { BUILDER_TABS, FormBuilderPage } from "./components/form-builder-page"
export type { BuilderTab } from "./components/form-builder-page"
export { FormsListPage } from "./components/forms-list-page"
export { createStarterContent, PALETTE_DEFAULTS } from "./lib/defaults"
export { slugify, uniqueSlug } from "./lib/slug"
