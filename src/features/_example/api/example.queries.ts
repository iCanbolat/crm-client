import { queryOptions } from "@tanstack/react-query"

import { fetchExamples } from "./example.api"
import { exampleKeys } from "./example.keys"
import type { ExampleListParams } from "./example.schemas"

export const exampleQueries = {
  list: (params: ExampleListParams) =>
    queryOptions({
      queryKey: exampleKeys.list(params),
      queryFn: ({ signal }) => fetchExamples(params, signal),
    }),
}
