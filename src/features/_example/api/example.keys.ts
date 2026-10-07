import type { ExampleListParams } from "./example.schemas"

export const exampleKeys = {
  all: ["examples"] as const,
  lists: () => [...exampleKeys.all, "list"] as const,
  list: (params: ExampleListParams) =>
    [...exampleKeys.lists(), params] as const,
}
