import { useMutation, useQueryClient } from "@tanstack/react-query"

import {
  markNotifications,
  updateNotificationPreferences,
} from "./notifications.api"
import { notificationKeys } from "./notifications.keys"

export function useMarkNotificationsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markNotifications,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() }),
  })
}

export function useUpdateNotificationPreferencesMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: (data) =>
      queryClient.setQueryData(notificationKeys.preferences(), data),
  })
}
