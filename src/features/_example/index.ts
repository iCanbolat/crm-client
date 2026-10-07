/**
 * Feature template (Faz 0). Copy this folder when starting a new feature:
 * api/ (schemas → api → keys → queries → mutations), components/, mocks/, __tests__/.
 * Only what is exported here may be imported by other layers.
 */
export { exampleKeys } from "./api/example.keys"
export { useCreateExample, useDeleteExample } from "./api/example.mutations"
export { exampleQueries } from "./api/example.queries"
export {
  createExampleInputSchema,
  EXAMPLE_LIST_DEFAULTS,
  exampleItemSchema,
  exampleListSearchSchema,
} from "./api/example.schemas"
export type {
  CreateExampleInput,
  ExampleItem,
  ExampleListParams,
  ExampleStatus,
} from "./api/example.schemas"
export { CreateExampleForm } from "./components/create-example-form"
export { ExampleList } from "./components/example-list"
export { ExamplesCard } from "./components/examples-card"
