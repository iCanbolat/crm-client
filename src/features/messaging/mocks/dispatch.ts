import {
  dispatchKey,
  matchTriggers,
  resolveTemplateParams,
  type MessageEvent,
  type TemplateLanguage,
} from "@/engine/messaging"
import { db } from "@/mocks/db"
import { getActiveManifests } from "@/mocks/modules"

import type { DispatchSkipReason } from "../api/messaging.schemas"
import {
  channelOf,
  ensureConversation,
  findTemplateDef,
  resolveRecipient,
  sendTemplate,
  settingsOf,
  templateContext,
  templateStatusOf,
} from "./store"
import type { DispatchRow } from "./types"

export function workspaceLanguage(workspaceId: string): TemplateLanguage {
  return db.workspaces.findById(workspaceId)?.language === "en" ? "en" : "tr"
}

export function triggersOf(workspaceId: string) {
  const modules = db.workspaces.findById(workspaceId)?.modules ?? []
  return getActiveManifests(modules).flatMap(
    (manifest) => manifest.messageTriggers ?? []
  )
}

/**
 * Backend side of an event that may send a WhatsApp notification (B6.5).
 * Switched-off triggers do nothing; switched-on ones send the template or
 * log why they could not. The same event never sends twice.
 */
export function dispatchMessageEvent(
  workspaceId: string,
  event: MessageEvent
): DispatchRow[] {
  const settings = settingsOf(workspaceId)
  const enabled = matchTriggers(triggersOf(workspaceId), event).filter(
    (trigger) => settings.triggers[trigger.id]
  )
  const results: DispatchRow[] = []
  for (const trigger of enabled) {
    const key = dispatchKey(trigger, event)
    if (
      db.messageDispatches.findFirst(
        (row) => row.workspaceId === workspaceId && row.key === key
      )
    ) {
      continue
    }
    const record = { objectKey: event.objectKey, recordId: event.recordId }
    const outcome = sendTemplateFor(
      workspaceId,
      trigger.templateId,
      record,
      event.data
    )
    results.push(
      db.messageDispatches.create({
        id: `dsp_${crypto.randomUUID().slice(0, 12)}`,
        workspaceId,
        key,
        triggerId: trigger.id,
        templateId: trigger.templateId,
        record,
        status: outcome.status,
        reason: outcome.reason,
        conversationId: outcome.conversationId,
        createdAt: new Date().toISOString(),
      })
    )
  }
  return results
}

export interface TemplateSendOutcome {
  status: DispatchRow["status"]
  reason: DispatchSkipReason | null
  conversationId: string | null
}

/**
 * Sends an approved template about a record to its WhatsApp recipient, or
 * says why it cannot (not connected, no consent, …). Shared by the automatic
 * notifications (B6.5) and automation rules (B7.3).
 */
export function sendTemplateFor(
  workspaceId: string,
  templateId: string,
  record: { objectKey: string; recordId: string },
  eventData?: Record<string, string>
): TemplateSendOutcome {
  const skipped = (reason: DispatchSkipReason): TemplateSendOutcome => ({
    status: "skipped",
    reason,
    conversationId: null,
  })
  const def = findTemplateDef(workspaceId, templateId)
  const language = workspaceLanguage(workspaceId)
  if (!channelOf(workspaceId) || !def) return skipped("notConnected")
  if (templateStatusOf(workspaceId, def, language) !== "approved") {
    return skipped("templateNotApproved")
  }
  const recipient = resolveRecipient(workspaceId, record)
  if (!recipient) return skipped("noRecipient")
  if (!recipient.phone) return skipped("noPhone")
  if (!recipient.optIn) return skipped("noOptIn")
  const context = templateContext(workspaceId, record)
  const { params, missing } = context
    ? resolveTemplateParams(def, { ...context, eventData }, language)
    : { params: [], missing: [1] }
  if (missing.length) return skipped("missingParams")
  const conversation = ensureConversation(workspaceId, recipient.phone, {
    contact: {
      objectKey: recipient.contact.objectKey,
      recordId: recipient.contact.recordId,
    },
  })
  sendTemplate({ conversation, def, language, params, record, sentBy: null })
  return { status: "sent", reason: null, conversationId: conversation.id }
}
