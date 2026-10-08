/**
 * WhatsApp channel (Faz 6): the tenant's own WABA connection (B6.1),
 * sector templates (B6.2), inbox (B6.3), template sends and the record tab
 * (B6.4), automatic notifications (B6.5).
 */
export { messagingKeys } from "./api/messaging.keys"
export { MESSAGING_POLL_MS, messagingQueries } from "./api/messaging.queries"
export {
  INBOX_SEARCH_DEFAULTS,
  inboxSearchSchema,
} from "./api/messaging.schemas"
export type {
  Conversation,
  InboxSearch,
  Message,
  MessageTemplate,
  WhatsappChannel,
} from "./api/messaging.schemas"
export { InboxUnreadBadge } from "./components/inbox-unread-badge"
export { InboxPage } from "./components/inbox/inbox-page"
export {
  RecordWhatsappTab,
  useHasWhatsappTab,
} from "./components/record-whatsapp-tab"
export {
  WHATSAPP_SETTINGS_TABS,
  WhatsappSettingsPage,
} from "./components/settings/whatsapp-settings-page"
export type { WhatsappSettingsTab } from "./components/settings/whatsapp-settings-page"
