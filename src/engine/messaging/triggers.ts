import type { MessageEvent, MessageTriggerDef } from "./types"

/** Triggers an event fires (their own on/off state is the caller's). */
export function matchTriggers(
  triggers: readonly MessageTriggerDef[],
  event: MessageEvent
) {
  return triggers.filter(
    (trigger) =>
      trigger.event === event.type &&
      Object.entries(trigger.match ?? {}).every(
        ([key, value]) => event.data?.[key] === value
      )
  )
}

/** Same event + record + data sends a trigger's message at most once. */
export function dispatchKey(trigger: MessageTriggerDef, event: MessageEvent) {
  const data = Object.entries(event.data ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&")
  return `${trigger.id}:${event.recordId}:${data}`
}
