import type { QuoteInput } from "../api/quotes.schemas"
import type { Milestone, QuoteStatus } from "../lib/constants"

/** One version of a quote: the full builder document (B3.4). */
export interface QuoteVersionRow {
  /** `${quoteId}:v${version}` */
  id: string
  workspaceId: string
  quoteId: string
  version: number
  /** Status the version had when it was superseded (or the current one). */
  status: QuoteStatus
  document: QuoteInput
  createdAt: string
  createdBy: string
}

export interface MilestoneRow {
  id: string
  workspaceId: string
  shipmentId: string
  milestone: Milestone
  at: string
  note: string | null
  createdBy: string
}
