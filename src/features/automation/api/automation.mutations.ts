import { useMutation, useQueryClient } from "@tanstack/react-query"

import type { AutomationRuleInput } from "@/engine/automation"

import {
  createAutomation,
  deleteAutomation,
  updateAutomation,
} from "./automation.api"
import { automationKeys } from "./automation.keys"
import type { AutomationRule } from "./automation.schemas"

export function useCreateAutomationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createAutomation,
    onSuccess: (rule) => {
      queryClient.setQueryData(automationKeys.detail(rule.id), rule)
      return queryClient.invalidateQueries({ queryKey: automationKeys.list() })
    },
  })
}

export function useUpdateAutomationMutation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<AutomationRuleInput>) =>
      updateAutomation(id, input),
    onSuccess: (rule) => {
      queryClient.setQueryData(automationKeys.detail(rule.id), rule)
      return queryClient.invalidateQueries({ queryKey: automationKeys.list() })
    },
  })
}

/** On/off switch of the list: optimistic, rolled back on error. */
export function useToggleAutomationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      updateAutomation(id, { enabled }),
    onMutate: async ({ id, enabled }) => {
      await queryClient.cancelQueries({ queryKey: automationKeys.list() })
      const previous = queryClient.getQueryData<{ data: AutomationRule[] }>(
        automationKeys.list()
      )
      queryClient.setQueryData<{ data: AutomationRule[] }>(
        automationKeys.list(),
        (current) =>
          current && {
            data: current.data.map((rule) =>
              rule.id === id ? { ...rule, enabled } : rule
            ),
          }
      )
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(automationKeys.list(), context.previous)
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: automationKeys.all }),
  })
}

export function useDeleteAutomationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteAutomation,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: automationKeys.list() }),
  })
}
