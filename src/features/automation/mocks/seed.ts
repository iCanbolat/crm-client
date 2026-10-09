import { SEED_USERS, WORKSPACE_IDS } from "@/mocks/db/seed"

import type { AutomationRow } from "./types"

/**
 * Acme starts with two rules: the web form round-robin (off, the Faz 7 demo
 * switches it on) and an unanswered quote follow-up (on). Time based rules
 * only consider quotes sent after `enabledAt`, so there is no backlog.
 */
export function seedAutomations(
  now = new Date().toISOString()
): AutomationRow[] {
  const base = {
    workspaceId: WORKSPACE_IDS.acme,
    lastAssigneeId: null,
    createdBy: SEED_USERS.owner.id,
    createdAt: now,
    updatedAt: now,
  }
  return [
    {
      ...base,
      id: "aut_acme_webform",
      name: "Web formundan gelen navlun taleplerini dağıt",
      enabled: false,
      enabledAt: null,
      trigger: { type: "submission.created", formId: "form_freight" },
      conditions: [],
      actions: [
        {
          type: "assignRoundRobin",
          userIds: [SEED_USERS.manager.id, SEED_USERS.agent.id],
        },
        {
          type: "createTask",
          title: "Navlun talebini 24 saat içinde ara",
          dueInDays: 1,
          assignee: "owner",
        },
      ],
    },
    {
      ...base,
      id: "aut_acme_quote_followup",
      name: "Yanıtsız teklif takibi",
      enabled: true,
      enabledAt: now,
      trigger: { type: "quote.noResponse", afterDays: 2 },
      conditions: [],
      actions: [
        {
          type: "createTask",
          title: "Teklif takibi: müşteriyi ara",
          dueInDays: 0,
          assignee: "owner",
        },
        { type: "notify", to: "owner" },
      ],
    },
  ]
}
