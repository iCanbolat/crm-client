import { z } from "zod"

import {
  MESSAGE_STATUSES,
  TEMPLATE_LANGUAGES,
  TEMPLATE_STATUSES,
  templateContentSchema,
  templateVariableSourceSchema,
} from "@/engine/messaging"
import { paginatedSchema } from "@/lib/api"

/* ------------------------------------------------------------ channel (B6.1) */

export const QUALITY_RATINGS = ["GREEN", "YELLOW", "RED", "UNKNOWN"] as const
export const MESSAGING_TIERS = [
  "TIER_250",
  "TIER_1K",
  "TIER_10K",
  "TIER_100K",
  "TIER_UNLIMITED",
] as const

/** Phone number details Meta returns for a valid credential set. */
export const phoneNumberInfoSchema = z.object({
  displayPhoneNumber: z.string(),
  verifiedName: z.string(),
  qualityRating: z.enum(QUALITY_RATINGS),
  messagingLimitTier: z.enum(MESSAGING_TIERS),
})
export type PhoneNumberInfo = z.infer<typeof phoneNumberInfoSchema>

/**
 * A connected WhatsApp Business number. Secrets are write-only: the access
 * token and app secret are never returned, only the token's last digits.
 */
export const whatsappConnectionSchema = phoneNumberInfoSchema.extend({
  wabaId: z.string(),
  phoneNumberId: z.string(),
  tokenLast4: z.string(),
  tokenUpdatedAt: z.iso.datetime(),
  connectedAt: z.iso.datetime(),
})
export type WhatsappConnection = z.infer<typeof whatsappConnectionSchema>

export const whatsappChannelSchema = z.object({
  connection: whatsappConnectionSchema.nullable(),
  /** Callback the tenant configures in their Meta app. */
  webhook: z.object({ url: z.string(), verifyToken: z.string() }),
  /** On/off state of each module trigger (B6.5). */
  triggers: z.record(z.string(), z.boolean()),
})
export type WhatsappChannel = z.infer<typeof whatsappChannelSchema>

/** What every member may know (inbox, record tab, nav). */
export const channelStatusSchema = z.object({
  connected: z.boolean(),
  displayPhoneNumber: z.string().nullable(),
})
export type ChannelStatus = z.infer<typeof channelStatusSchema>

const numericId = z
  .string()
  .trim()
  .regex(/^\d{6,20}$/)

/** Meta app secrets are 32 hexadecimal characters. */
export const APP_SECRET_PATTERN = /^[a-f0-9]{32}$/i

export const connectChannelInputSchema = z.object({
  wabaId: numericId,
  phoneNumberId: numericId,
  /** Optional when updating a connection: the stored token is kept. */
  accessToken: z.string().trim().min(20).max(1024).optional(),
  appSecret: z.string().trim().regex(APP_SECRET_PATTERN).optional(),
})
export type ConnectChannelInput = z.infer<typeof connectChannelInputSchema>

export const updateTriggersInputSchema = z.object({
  triggers: z.record(z.string(), z.boolean()),
})

/* ----------------------------------------------------------- templates (B6.2) */

export const messageTemplateSchema = z.object({
  /** Template id of the module (`forwarding.shipmentDeparted`). */
  id: z.string(),
  name: z.string(),
  moduleId: z.string(),
  category: z.literal("utility"),
  objectKey: z.string(),
  label: z.object({ tr: z.string(), en: z.string() }),
  variables: z.array(
    z.object({
      source: templateVariableSourceSchema,
      example: z.object({ tr: z.string(), en: z.string() }),
    })
  ),
  content: z.object({ tr: templateContentSchema, en: templateContentSchema }),
  /** Review state per submitted language; empty until a WABA is connected. */
  submissions: z.array(
    z.object({
      language: z.enum(TEMPLATE_LANGUAGES),
      status: z.enum(TEMPLATE_STATUSES),
      /** Meta's rejection reason code (e.g. `INVALID_FORMAT`). */
      rejectionReason: z.string().nullable(),
      updatedAt: z.iso.datetime(),
    })
  ),
})
export type MessageTemplate = z.infer<typeof messageTemplateSchema>

export const messageTemplateListSchema = z.object({
  data: z.array(messageTemplateSchema),
})

/* ------------------------------------------------------- conversations (B6.3) */

export const recordLinkSchema = z.object({
  objectKey: z.string(),
  recordId: z.string(),
  label: z.string(),
})
export type RecordLink = z.infer<typeof recordLinkSchema>

export const CONVERSATION_STATUSES = ["open", "closed"] as const

export const conversationSchema = z.object({
  id: z.string(),
  /** Customer's number (E.164). */
  phone: z.string(),
  /** WhatsApp profile name of the customer. */
  profileName: z.string().nullable(),
  /** Contact or lead the number belongs to. */
  contact: recordLinkSchema.nullable(),
  optIn: z.boolean(),
  assigneeId: z.string().nullable(),
  assigneeName: z.string().nullable(),
  status: z.enum(CONVERSATION_STATUSES),
  unreadCount: z.number().int().min(0),
  lastMessageAt: z.iso.datetime(),
  lastMessagePreview: z.string(),
  lastMessageDirection: z.enum(["inbound", "outbound"]),
  /** Start of the 24 h customer service window. */
  lastInboundAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
})
export type Conversation = z.infer<typeof conversationSchema>

export const conversationListSchema = paginatedSchema(conversationSchema)

export const CONVERSATION_FILTERS = ["open", "closed", "all"] as const
export const ASSIGNEE_FILTERS = ["all", "me", "unassigned"] as const

export const inboxSearchSchema = z.object({
  status: z.enum(CONVERSATION_FILTERS).default("open").catch("open"),
  assignee: z.enum(ASSIGNEE_FILTERS).default("all").catch("all"),
  unread: z.boolean().default(false).catch(false),
  q: z.string().default("").catch(""),
  /** Open conversation. */
  c: z.string().optional().catch(undefined),
})
export type InboxSearch = z.infer<typeof inboxSearchSchema>
export const INBOX_SEARCH_DEFAULTS = {
  status: "open",
  assignee: "all",
  unread: false,
  q: "",
} as const satisfies Partial<InboxSearch>

export type ConversationQuery = Omit<InboxSearch, "c">

export const inboxSummarySchema = z.object({ unread: z.number().int() })

export const conversationPatchSchema = z.object({
  /** Links an unknown number to a contact or lead. */
  contact: z
    .object({ objectKey: z.enum(["contact", "lead"]), recordId: z.string() })
    .optional(),
  assigneeId: z.string().nullable().optional(),
  status: z.enum(CONVERSATION_STATUSES).optional(),
  read: z.literal(true).optional(),
})
export type ConversationPatch = z.infer<typeof conversationPatchSchema>

export const messageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  direction: z.enum(["inbound", "outbound"]),
  type: z.enum(["text", "template"]),
  /** Rendered text (templates: header + body + footer). */
  body: z.string(),
  template: z
    .object({
      id: z.string(),
      name: z.string(),
      language: z.enum(TEMPLATE_LANGUAGES),
      header: z.string().nullable(),
      footer: z.string().nullable(),
    })
    .nullable(),
  status: z.enum(MESSAGE_STATUSES),
  error: z.object({ code: z.number(), message: z.string() }).nullable(),
  /** Record the message is about (templates). */
  record: recordLinkSchema.nullable(),
  /** Sender; `null` = automatic notification or the customer. */
  sentBy: z.string().nullable(),
  sentByName: z.string().nullable(),
  createdAt: z.iso.datetime(),
})
export type Message = z.infer<typeof messageSchema>

export const messageListSchema = z.object({ data: z.array(messageSchema) })

export const MESSAGE_TEXT_MAX = 4096

export const sendMessageInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    body: z.string().trim().min(1).max(MESSAGE_TEXT_MAX),
  }),
  z.object({
    type: z.literal("template"),
    templateId: z.string(),
    language: z.enum(TEMPLATE_LANGUAGES),
    record: z
      .object({ objectKey: z.string(), recordId: z.string() })
      .nullable()
      .default(null),
    /** `{{n}}` values, prefilled from the record and editable. */
    params: z.array(z.string()),
  }),
])
export type SendMessageInput = z.input<typeof sendMessageInputSchema>

/* ---------------------------------------------------- record tab (B6.4) */

export const recordRecipientSchema = z.object({
  /** Contact/lead receiving the messages. */
  contact: recordLinkSchema,
  phone: z.string().nullable(),
  optIn: z.boolean(),
})

export const recordConversationSchema = z.object({
  recipient: recordRecipientSchema.nullable(),
  conversation: conversationSchema.nullable(),
})
export type RecordConversation = z.infer<typeof recordConversationSchema>

/* ---------------------------------------------------- dispatch log (B6.5) */

export const DISPATCH_SKIP_REASONS = [
  "notConnected",
  "templateNotApproved",
  "noRecipient",
  "noPhone",
  "noOptIn",
  "missingParams",
] as const
export type DispatchSkipReason = (typeof DISPATCH_SKIP_REASONS)[number]

export const dispatchSchema = z.object({
  id: z.string(),
  triggerId: z.string(),
  templateId: z.string(),
  record: recordLinkSchema,
  status: z.enum(["sent", "skipped"]),
  reason: z.enum(DISPATCH_SKIP_REASONS).nullable(),
  conversationId: z.string().nullable(),
  createdAt: z.iso.datetime(),
})
export type Dispatch = z.infer<typeof dispatchSchema>

export const dispatchListSchema = z.object({ data: z.array(dispatchSchema) })
