import type { FieldDef, ObjectDef } from "../metadata/schemas"

/**
 * Who a record's WhatsApp messages go to:
 * - `self`: the record has a phone field (contact, lead)
 * - `relation`: it links a contact (quote, shipment, deal)
 */
export type RecipientRule =
  { kind: "self"; phoneField: string } | { kind: "relation"; field: string }

const isContactRelation = (field: FieldDef) =>
  field.type === "relation" && field.relation?.objectKey === "contact"

export function getRecipientRule(objectDef: ObjectDef): RecipientRule | null {
  const phone = objectDef.fields.find((field) => field.type === "phone")
  if (phone) return { kind: "self", phoneField: phone.key }
  const contact = objectDef.fields.find(isContactRelation)
  return contact ? { kind: "relation", field: contact.key } : null
}

/** Consent fields kept on contacts and leads (Faz 6). */
export const OPT_IN_FIELD = "whatsappOptIn"
export const OPT_IN_AT_FIELD = "whatsappOptInAt"
