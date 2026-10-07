import { queryOptions } from "@tanstack/react-query"

import { fetchMe } from "./auth.api"
import { authKeys } from "./auth.keys"

export const authQueries = {
  me: () =>
    queryOptions({
      queryKey: authKeys.me(),
      queryFn: ({ signal }) => fetchMe(signal),
      staleTime: 5 * 60_000,
    }),
}
