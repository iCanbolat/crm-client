import type { AutomationRuleInput } from "@/engine/automation"

import type { AutomationRun } from "../api/automation.schemas"

export interface AutomationRow extends AutomationRuleInput {
  id: string
  workspaceId: string
  enabledAt: string | null
  /** Last user picked by a round-robin action. */
  lastAssigneeId: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface AutomationRunRow extends AutomationRun {
  workspaceId: string
  /** Idempotency key (`automationRunKey`). */
  key: string
}
