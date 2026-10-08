import type { MessageStatus } from "./types"

/** Meta's customer service window: free text only within 24 h of a reply. */
export const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000

export function windowClosesAt(lastInboundAt: string | null | undefined) {
  if (!lastInboundAt) return null
  return new Date(
    new Date(lastInboundAt).getTime() + CUSTOMER_SERVICE_WINDOW_MS
  )
}

export function isWindowOpen(
  lastInboundAt: string | null | undefined,
  now: Date = new Date()
) {
  const closes = windowClosesAt(lastInboundAt)
  return !!closes && closes.getTime() > now.getTime()
}

const STATUS_RANK: Record<MessageStatus, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 1,
}

/**
 * Webhook status updates may arrive out of order: a message never moves
 * back (read stays read) and only a message not yet delivered can fail.
 */
export function advanceStatus(
  current: MessageStatus,
  next: MessageStatus
): MessageStatus {
  if (current === "failed") return current
  if (next === "failed") return STATUS_RANK[current] <= 1 ? "failed" : current
  return STATUS_RANK[next] > STATUS_RANK[current] ? next : current
}

/** Meta's `wa_id`: E.164 without the plus sign. */
export function toWaId(e164: string) {
  return e164.replace(/^\+/, "")
}

export function fromWaId(waId: string) {
  return waId.startsWith("+") ? waId : `+${waId}`
}

const OPT_OUT_KEYWORDS = new Set([
  "DUR",
  "STOP",
  "IPTAL",
  "İPTAL",
  "UNSUBSCRIBE",
  "ABONELIKTEN CIK",
  "ABONELİKTEN ÇIK",
])

/** A reply that withdraws consent ("DUR", "STOP", …). */
export function isOptOutMessage(text: string) {
  const normalized = text
    .trim()
    .replace(/[.!]+$/, "")
    .toLocaleUpperCase("tr")
  return OPT_OUT_KEYWORDS.has(normalized)
}
