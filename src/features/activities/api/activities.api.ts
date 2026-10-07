import { apiClient } from "@/lib/api"

import {
  activityListSchema,
  activitySchema,
  taskListSchema,
  taskSchema,
  type ActivityInput,
  type TaskInput,
  type TaskPatch,
  type TaskQuery,
} from "./activities.schemas"

const segment = encodeURIComponent

export function fetchActivities(
  objectKey: string,
  recordId: string,
  signal?: AbortSignal
) {
  return apiClient.get(
    `/records/${segment(objectKey)}/${segment(recordId)}/activities`,
    { signal, schema: activityListSchema }
  )
}

export function createActivity(
  objectKey: string,
  recordId: string,
  input: ActivityInput
) {
  return apiClient.post(
    `/records/${segment(objectKey)}/${segment(recordId)}/activities`,
    { body: input, schema: activitySchema }
  )
}

export function fetchTasks(query: TaskQuery, signal?: AbortSignal) {
  return apiClient.get("/tasks", {
    query: { ...query },
    signal,
    schema: taskListSchema,
  })
}

export function createTask(input: TaskInput) {
  return apiClient.post("/tasks", { body: input, schema: taskSchema })
}

export function updateTask(id: string, patch: TaskPatch) {
  return apiClient.patch(`/tasks/${segment(id)}`, {
    body: patch,
    schema: taskSchema,
  })
}
