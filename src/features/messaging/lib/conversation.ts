import type { Conversation } from "../api/messaging.schemas"

/** Contact/lead name, else WhatsApp profile name, else the number. */
export function conversationTitle(
  conversation: Pick<Conversation, "contact" | "profileName" | "phone">
) {
  return (
    conversation.contact?.label ??
    conversation.profileName ??
    conversation.phone
  )
}

/** Remaining time of the 24 h window split for display. */
export function splitDuration(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60_000))
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 }
}

/** Calendar day key of a message (local time) for day separators. */
export function dayKey(iso: string) {
  const date = new Date(iso)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}
