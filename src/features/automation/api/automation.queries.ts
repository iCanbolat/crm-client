import { queryOptions } from "@tanstack/react-query"

import {
  fetchAutomation,
  fetchAutomationRuns,
  fetchAutomations,
} from "./automation.api"
import { automationKeys } from "./automation.keys"

export const automationQueries = {
  list: () =>
    queryOptions({
      queryKey: automationKeys.list(),
      queryFn: ({ signal }) => fetchAutomations(signal),
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: automationKeys.detail(id),
      queryFn: ({ signal }) => fetchAutomation(id, signal),
    }),
  runs: (id: string) =>
    queryOptions({
      queryKey: automationKeys.runs(id),
      queryFn: ({ signal }) => fetchAutomationRuns(id, signal),
    }),
}
