import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { fetchActivities, fetchTasks } from "./activities.api"
import type { TaskQuery } from "./activities.schemas"

export const activityKeys = {
  all: ["activities"] as const,
  record: (objectKey: string, recordId: string) =>
    [...activityKeys.all, objectKey, recordId] as const,
}

export const taskKeys = {
  all: ["tasks"] as const,
  list: (query: TaskQuery) => [...taskKeys.all, query] as const,
}

export const activityQueries = {
  record: (objectKey: string, recordId: string) =>
    queryOptions({
      queryKey: activityKeys.record(objectKey, recordId),
      queryFn: ({ signal }) => fetchActivities(objectKey, recordId, signal),
    }),
}

export const taskQueries = {
  list: (query: TaskQuery) =>
    queryOptions({
      queryKey: taskKeys.list(query),
      queryFn: ({ signal }) => fetchTasks(query, signal),
      placeholderData: keepPreviousData,
    }),
}
