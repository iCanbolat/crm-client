import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { createActivity, createTask, updateTask } from "./activities.api"
import { activityKeys, taskKeys } from "./activities.queries"
import type { Activity, Task, TaskList, TaskPatch } from "./activities.schemas"

export function useCreateActivity(objectKey: string, recordId: string) {
  const { t } = useTranslation("activities")
  const queryClient = useQueryClient()
  const key = activityKeys.record(objectKey, recordId)

  return useMutation({
    mutationFn: (input: Parameters<typeof createActivity>[2]) =>
      createActivity(objectKey, recordId, input),
    meta: { successMessage: t("timeline.saved") },
    onSuccess: (activity) => {
      // Newest first: the new entry goes on top right away.
      queryClient.setQueryData<{ data: Activity[] }>(key, (current) =>
        current ? { data: [activity, ...current.data] } : current
      )
      return queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

export function useCreateTask() {
  const { t } = useTranslation("activities")
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createTask,
    meta: { successMessage: t("tasks.created") },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.all }),
  })
}

/** Optimistic (checkbox): every cached task list reflects the change at once. */
export function useUpdateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TaskPatch }) =>
      updateTask(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all })
      const previous = queryClient.getQueriesData<TaskList>({
        queryKey: taskKeys.all,
      })
      queryClient.setQueriesData<TaskList>(
        { queryKey: taskKeys.all },
        (list) =>
          list
            ? {
                ...list,
                data: list.data.map((task): Task =>
                  task.id === id ? { ...task, ...patch } : task
                ),
              }
            : list
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data)
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: taskKeys.all }),
  })
}
