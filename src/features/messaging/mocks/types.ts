import type {
  MessageStatus,
  TemplateLanguage,
  TemplateStatus,
} from "@/engine/messaging"

import type {
  DispatchSkipReason,
  PhoneNumberInfo,
} from "../api/messaging.schemas"

/** A connected WhatsApp Business number (one per workspace). */
export interface WaChannelRow extends PhoneNumberInfo {
  /** `wa_${workspaceId}` */
  id: string
  workspaceId: string
  wabaId: string
  phoneNumberId: string
  /**
   * Stored for the mock only. A real backend keeps secrets encrypted (KMS)
   * and never returns them; the API only exposes `tokenLast4`.
   */
  accessToken: string
  appSecret: string | null
  tokenUpdatedAt: string
  connectedAt: string
}

/** Settings that survive a disconnect: webhook token, trigger switches. */
export interface WaSettingsRow {
  /** `was_${workspaceId}` */
  id: string
  workspaceId: string
  verifyToken: string
  triggers: Record<string, boolean>
}

/** A module template submitted to the workspace's WABA in one language. */
export interface WaTemplateRow {
  id: string
  workspaceId: string
  templateId: string
  moduleId: string
  name: string
  language: TemplateLanguage
  status: TemplateStatus
  rejectionReason: string | null
  submittedAt: string
  updatedAt: string
}

export interface RecordKey {
  objectKey: string
  recordId: string
}

export interface ConversationRow {
  id: string
  workspaceId: string
  phone: string
  profileName: string | null
  contact: RecordKey | null
  assigneeId: string | null
  status: "open" | "closed"
  unreadCount: number
  lastMessageAt: string
  lastMessagePreview: string
  lastMessageDirection: "inbound" | "outbound"
  lastInboundAt: string | null
  createdAt: string
}

export interface MessageRow {
  id: string
  workspaceId: string
  conversationId: string
  /** Meta message id (`wamid.…`). */
  wamid: string
  direction: "inbound" | "outbound"
  type: "text" | "template"
  body: string
  template: {
    id: string
    name: string
    language: TemplateLanguage
    header: string | null
    footer: string | null
  } | null
  status: MessageStatus
  error: { code: number; message: string } | null
  record: RecordKey | null
  sentBy: string | null
  /** Start of the delivery run; statuses advance from here on reads. */
  queuedAt: string
  createdAt: string
}

/** Log entry of an automatic notification (B6.5). */
export interface DispatchRow {
  id: string
  workspaceId: string
  /** Idempotency key: trigger + record + event data. */
  key: string
  triggerId: string
  templateId: string
  record: RecordKey
  status: "sent" | "skipped"
  reason: DispatchSkipReason | null
  conversationId: string | null
  createdAt: string
}
