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
    const log = (
      status: DispatchRow["status"],
      reason: DispatchSkipReason | null,
      conversationId: string | null = null
    ) => {
      const row = db.messageDispatches.create({
        id: `dsp_${crypto.randomUUID().slice(0, 12)}`,
        workspaceId,
        key,
        triggerId: trigger.id,
        templateId: trigger.templateId,
        record,
        status,
        reason,
        conversationId,
        createdAt: new Date().toISOString(),
      })
      results.push(row)
    }

    const def = findTemplateDef(workspaceId, trigger.templateId)
    const language = workspaceLanguage(workspaceId)
    if (!channelOf(workspaceId) || !def) {
      log("skipped", "notConnected")
      continue
    }
    if (templateStatusOf(workspaceId, def, language) !== "approved") {
      log("skipped", "templateNotApproved")
      continue
    }
    const recipient = resolveRecipient(workspaceId, record)
    if (!recipient) {
      log("skipped", "noRecipient")
      continue
    }
    if (!recipient.phone) {
      log("skipped", "noPhone")
      continue
    }
    if (!recipient.optIn) {
      log("skipped", "noOptIn")
      continue
    }
    const context = templateContext(workspaceId, record)
    const { params, missing } = context
      ? resolveTemplateParams(
          def,
          { ...context, eventData: event.data },
          language
        )
      : { params: [], missing: [1] }
    if (missing.length) {
      log("skipped", "missingParams")
      continue
    }
    const conversation = ensureConversation(workspaceId, recipient.phone, {
      contact: {
        objectKey: recipient.contact.objectKey,
        recordId: recipient.contact.recordId,
      },
    })
    sendTemplate({
      conversation,
      def,
      language,
      params,
      record,
      sentBy: null,
    })
    log("sent", null, conversation.id)
  }
  return results
}
