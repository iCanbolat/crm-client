/**
 * Domain events of the mock backend (Faz 7): what happened to which record,
 * for notifications and automation rules. Emitted after the change is stored;
 * listeners run synchronously in registration order.
 *
 * - `record.created`, `record.assigned` (`data.ownerId`, `data.previousOwnerId`),
 *   `record.stageChanged` (`data.stage`, `data.previousStage`)
 * - `submission.created`: `objectKey`/`recordId` = the created (or linked)
 *   record, else the submission; `data.formId`, `data.submissionId`
 * - `conversation.inbound`: a customer wrote on WhatsApp (`recordId` = the
 *   conversation)
 *
 * WhatsApp notifications of Faz 6 keep their own `dispatchMessageEvent` calls.
 */
export interface MockEvent {
  workspaceId: string
  type: string
  objectKey: string
  recordId: string
  data?: Record<string, string>
  /** User whose request caused the event; `null` = system / public. */
  actorId?: string | null
}

type Listener = (event: MockEvent) => void

const listeners = new Set<Listener>()

export function onMockEvent(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitMockEvent(event: MockEvent) {
  for (const listener of [...listeners]) listener(event)
}
