import { foldText } from "@/engine/logic"
import type { RecordValues } from "@/engine/metadata"

import type { ConversionMatch, MatchReason } from "../api/leads.schemas"

interface Candidate {
  id: string
  values: RecordValues
}

const REASON_ORDER: MatchReason[] = ["email", "taxNumber", "domain", "name"]
const MAX_MATCHES = 5

/** "ayse@Acme.com.tr" / "https://www.acme.com.tr/x" → "acme.com.tr" */
export function domainOf(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null
  const text = value.trim().toLowerCase()
  if (text.includes("@")) return text.split("@").pop() || null
  try {
    const url = new URL(text.includes("://") ? text : `https://${text}`)
    return url.hostname.replace(/^www\./, "") || null
  } catch {
    return null
  }
}

/** Public mailbox domains say nothing about the company. */
const FREE_MAIL = new Set([
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "icloud.com",
  "yandex.com",
])

const sameText = (a: unknown, b: unknown) => {
  const left = foldText(a).trim()
  return left.length > 0 && left === foldText(b).trim()
}

function sortMatches(matches: (ConversionMatch & { rank: number })[]) {
  return matches
    .sort(
      (a, b) =>
        REASON_ORDER.indexOf(a.reason) - REASON_ORDER.indexOf(b.reason) ||
        a.rank - b.rank
    )
    .slice(0, MAX_MATCHES)
    .map(({ rank: _rank, ...match }) => match)
}

/**
 * Existing companies a lead probably belongs to (TC-3.3-02): same tax
 * number, same email/web domain, or the same (folded) name.
 */
export function matchCompanies(
  lead: RecordValues,
  companies: readonly Candidate[]
): ConversionMatch[] {
  const leadDomain = domainOf(lead.email)
  const domain = leadDomain && !FREE_MAIL.has(leadDomain) ? leadDomain : null
  const matches = companies.flatMap((company, rank) => {
    const label = String(company.values.name ?? company.id)
    let reason: MatchReason | null = null
    if (lead.taxNumber && sameText(lead.taxNumber, company.values.taxNumber)) {
      reason = "taxNumber"
    } else if (
      domain &&
      (domainOf(company.values.email) === domain ||
        domainOf(company.values.domain) === domain)
    ) {
      reason = "domain"
    } else if (sameText(lead.companyName, company.values.name)) {
      reason = "name"
    }
    return reason ? [{ id: company.id, label, reason, rank }] : []
  })
  return sortMatches(matches)
}

/** Existing contacts with the lead's email or name. */
export function matchContacts(
  lead: RecordValues,
  contacts: readonly Candidate[]
): ConversionMatch[] {
  const matches = contacts.flatMap((contact, rank) => {
    const label = String(contact.values.name ?? contact.id)
    const reason: MatchReason | null =
      lead.email && sameText(lead.email, contact.values.email)
        ? "email"
        : sameText(lead.name, contact.values.name)
          ? "name"
          : null
    return reason ? [{ id: contact.id, label, reason, rank }] : []
  })
  return sortMatches(matches)
}
